import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import { isAcademicYearWritable } from "@/lib/academic-year";
import { getPhilippineCalendarDate } from "@/lib/academic-term-current";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import { lockAcademicYearForAcademicTerms } from "@/repositories/academic-year.repository";
import { findActiveSectionForAssignment, findActiveSectionsForAssignment } from "@/repositories/section.repository";
import { findActiveTeacherForAssignment, findActiveTeachersForAssignment } from "@/repositories/teacher.repository";
import { archiveSubjectAssignment, countSubjectAssignmentHistory, createSubjectAssignment, findActiveAcademicYearsForAssignment, findActiveAcademicYearsForMatrix, findActiveSubjectAssignment, findActiveSubjectAssignmentById, findActiveSubjectAssignmentsForMatrixMutation, findAllSubjectAssignments, findAssignmentMatrixAssignments, findAssignmentMatrixScopes, findAssignmentMatrixSections, findAssignmentMatrixTeacherLoads, findAssignmentScope, findAssignmentScopes, findSubjectAssignmentHistory, findSubjectAssignmentHistoryFilterOptions, findSubjectAssignmentHistoryOptions, updateSubjectAssignment } from "@/repositories/subject-assignment.repository";
import { AssignmentMatrixMutationSchema, AssignmentMatrixQuerySchema, CreateSubjectAssignmentSchema, SubjectAssignmentHistoryFilterOptionsQuerySchema, SubjectAssignmentHistoryOptionsQuerySchema, SubjectAssignmentHistoryQuerySchema, type AssignmentMatrixMutation, type AssignmentMatrixQuery, type SubjectAssignmentHistoryOption, type SubjectAssignmentHistoryOptionsQuery, type SubjectAssignmentHistoryQuery, type SubjectAssignmentHistoryPage, type SubjectAssignmentListItem, UpdateSubjectAssignmentSchema } from "@/schemas";
import { z } from "zod";

type Values = z.infer<typeof CreateSubjectAssignmentSchema>;

function termHasStarted(startDate: Date) { return startDate.toISOString().slice(0, 10) <= getPhilippineCalendarDate(); }
function slotName(scope: NonNullable<Awaited<ReturnType<typeof findAssignmentScope>>>, sectionName: string) { return `${scope.subjectOffering.subjectCode} - ${scope.subjectOffering.subjectDescription} | ${scope.academicTerm.name} | ${sectionName}`; }

async function validateValues(values: Values, transaction: Prisma.TransactionClient) {
  const [teacher, section, scope] = await Promise.all([findActiveTeacherForAssignment(values.teacherId, transaction), findActiveSectionForAssignment(values.sectionId, transaction), findAssignmentScope(values.subjectOfferingId, values.academicTermId, transaction)]);
  if (!teacher) throw new Error("Teacher not found or inactive.");
  if (!section) throw new Error("Section not found or inactive.");
  if (!scope || scope.subjectOffering.deletedAt) throw new Error("Curriculum Offering Term not found or archived.");
  if (!isAcademicYearWritable(scope.subjectOffering.academicYear.status)) throw new Error("Curriculum Offering Academic Year is not active.");
  if (scope.subjectOffering.gradeLevel !== section.gradeLevel) throw new Error("Curriculum Offering and Section grade levels must match.");
  if (scope.subjectOffering.gradeLevel === "11" || scope.subjectOffering.gradeLevel === "12") {
    if (scope.subjectOffering.shsContext?.curriculumStatus !== "SCHOOL_APPROVED") throw new Error("SHS Curriculum Offering must be school approved before assignment.");
  }
  return { teacher, section, scope };
}

function conflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("An active Teacher assignment already exists for this Curriculum Offering Term and Section.");
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") throw new Error("Teaching assignment state changed concurrently. Refresh the matrix and try again.");
  throw error;
}

type MatrixScope = {
  subjectOfferingId: string;
  academicTermId: string;
  sectionId: string;
  expectedAssignmentId: string | null;
};

const scopeKey = (scope: Pick<MatrixScope, "subjectOfferingId" | "academicTermId" | "sectionId">) => `${scope.subjectOfferingId}:${scope.academicTermId}:${scope.sectionId}`;

function assertDistinctScopes(scopes: MatrixScope[]) {
  const seen = new Set<string>();
  for (const scope of scopes) {
    const key = scopeKey(scope);
    if (seen.has(key)) throw new Error("Duplicate teaching assignment scope submitted.");
    seen.add(key);
  }
}

async function validateMatrixScope(
  scope: MatrixScope,
  academicYearId: string,
  gradeLevel: string,
  transaction: Prisma.TransactionClient,
) {
  const [section, offeringTerm] = await Promise.all([
    findActiveSectionForAssignment(scope.sectionId, transaction),
    findAssignmentScope(scope.subjectOfferingId, scope.academicTermId, transaction),
  ]);
  if (!section) throw new Error("Section not found or inactive.");
  if (!offeringTerm || offeringTerm.subjectOffering.deletedAt) throw new Error("Curriculum Offering Term not found or archived.");
  if (offeringTerm.subjectOffering.academicYear.id !== academicYearId || offeringTerm.subjectOffering.gradeLevel !== gradeLevel) throw new Error("Teaching assignment scope is outside the active matrix.");
  if (section.gradeLevel !== offeringTerm.subjectOffering.gradeLevel) throw new Error("Curriculum Offering and Section grade levels must match.");
  if ((gradeLevel === "11" || gradeLevel === "12") && offeringTerm.subjectOffering.shsContext?.curriculumStatus !== "SCHOOL_APPROVED") throw new Error("SHS Curriculum Offering must be school approved before assignment.");
  return { section, offeringTerm };
}

function assertExpectedAssignment(
  scope: MatrixScope,
  assignment: { id: string; teacherId: string } | undefined,
) {
  if (scope.expectedAssignmentId !== (assignment?.id ?? null)) {
    throw new Error("Teaching assignment state is stale. Refresh the matrix and try again.");
  }
}

export async function mutateAssignmentMatrix(values: AssignmentMatrixMutation) {
  const session = await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  const validated = AssignmentMatrixMutationSchema.parse(values);
  const requestedScopes = validated.action === "COPY"
    ? [...validated.sourceScopes, ...validated.destinationScopes]
    : validated.scopes;
  assertDistinctScopes(requestedScopes);
  try {
    return await prisma.$transaction(async (transaction) => {
      const academicYear = await lockAcademicYearForAcademicTerms(validated.academicYearId, transaction, "SHARE");
      if (!academicYear || !isAcademicYearWritable(academicYear.status)) throw new Error("Teaching assignments can only be changed while their Academic Year is active.");

      const orderedScopes = [...requestedScopes].sort((a, b) => scopeKey(a).localeCompare(scopeKey(b)));
      const scopeDetails = new Map<string, Awaited<ReturnType<typeof validateMatrixScope>>>();
      for (const scope of orderedScopes) {
        scopeDetails.set(scopeKey(scope), await validateMatrixScope(scope, validated.academicYearId, validated.gradeLevel, transaction));
      }
      const activeAssignments = await findActiveSubjectAssignmentsForMatrixMutation(orderedScopes, transaction);
      const assignmentByScope = new Map(activeAssignments.map((assignment) => [scopeKey(assignment), assignment]));

      let teacherId: string | undefined;
      if (validated.action === "ASSIGN") {
        const teacher = await findActiveTeacherForAssignment(validated.teacherId, transaction);
        if (!teacher) throw new Error("Teacher not found or inactive.");
        teacherId = teacher.id;
      }

      const changes: Array<{ action: "CREATE" | "UPDATE" | "ARCHIVE"; scope: MatrixScope; teacherId?: string; previousTeacherId?: string }> = [];
      if (validated.action === "COPY") {
        const sourceTeacherByOfferingTerm = new Map<string, string>();
        for (const source of validated.sourceScopes) {
          const assignment = assignmentByScope.get(scopeKey(source));
          assertExpectedAssignment(source, assignment);
          if (!assignment) throw new Error("Copy source assignment is no longer available. Refresh the matrix and try again.");
          sourceTeacherByOfferingTerm.set(`${source.subjectOfferingId}:${source.academicTermId}`, assignment.teacherId);
        }
        for (const sourceTeacherId of new Set(sourceTeacherByOfferingTerm.values())) {
          if (!await findActiveTeacherForAssignment(sourceTeacherId, transaction)) {
            throw new Error("Copy source Teacher not found or inactive.");
          }
        }
        for (const destination of validated.destinationScopes) {
          const assignment = assignmentByScope.get(scopeKey(destination));
          assertExpectedAssignment(destination, assignment);
          const copiedTeacherId = sourceTeacherByOfferingTerm.get(`${destination.subjectOfferingId}:${destination.academicTermId}`);
          if (!copiedTeacherId) throw new Error("Every copy destination must match an explicitly selected source Offering Term.");
          changes.push({ action: assignment ? "UPDATE" : "CREATE", scope: destination, teacherId: copiedTeacherId, previousTeacherId: assignment?.teacherId });
        }
      } else {
        for (const scope of validated.scopes) {
          const assignment = assignmentByScope.get(scopeKey(scope));
          assertExpectedAssignment(scope, assignment);
          changes.push({ action: validated.action === "CLEAR" ? "ARCHIVE" : assignment ? "UPDATE" : "CREATE", scope, teacherId, previousTeacherId: assignment?.teacherId });
        }
      }

      const changedAssignmentIds: string[] = [];
      const audits: Prisma.AuditLogCreateManyInput[] = [];
      for (const change of changes.sort((a, b) => scopeKey(a.scope).localeCompare(scopeKey(b.scope)))) {
        const current = assignmentByScope.get(scopeKey(change.scope));
        const detail = scopeDetails.get(scopeKey(change.scope));
        if (!detail) throw new Error("Teaching assignment scope is invalid.");
        const started = termHasStarted(detail.offeringTerm.academicTerm.startDate);
        if (change.action === "CREATE") {
          if (current) throw new Error("Teaching assignment state is stale. Refresh the matrix and try again.");
          const assignment = await createSubjectAssignment({
            subjectOfferingId: change.scope.subjectOfferingId,
            academicTermId: change.scope.academicTermId,
            sectionId: change.scope.sectionId,
            teacherId: change.teacherId!,
          }, transaction);
          changedAssignmentIds.push(assignment.id);
          audits.push({ userId: session.user.id, action: "CREATE", module: "SubjectAssignment", recordId: assignment.id, recordName: slotName(detail.offeringTerm, detail.section.sectionName), description: "Created Teacher assignment for Curriculum Offering Term.", metadata: { source: "TeachingMatrix", academicYearId: validated.academicYearId } });
        } else {
          if (!current) throw new Error("Teaching assignment state is stale. Refresh the matrix and try again.");
          if (change.action === "UPDATE" && current.teacherId === change.teacherId) continue;
          if (started) throw new Error(change.action === "ARCHIVE" ? "This Term has started. Assigned teaching ownership cannot be cleared." : "This Term has started. Assigned teaching ownership cannot be changed.");
          if (change.action === "UPDATE") {
            const assignment = await updateSubjectAssignment(current.id, { teacherId: change.teacherId! }, transaction);
            changedAssignmentIds.push(assignment.id);
            audits.push({ userId: session.user.id, action: "UPDATE", module: "SubjectAssignment", recordId: assignment.id, recordName: slotName(detail.offeringTerm, detail.section.sectionName), description: "Updated Teacher assignment for Curriculum Offering Term.", metadata: { source: "TeachingMatrix", previousTeacherId: current.teacherId, teacherId: change.teacherId } });
          } else {
            const assignment = await archiveSubjectAssignment(current.id, transaction);
            changedAssignmentIds.push(assignment.id);
            audits.push({ userId: session.user.id, action: "ARCHIVE", module: "SubjectAssignment", recordId: assignment.id, recordName: slotName(detail.offeringTerm, detail.section.sectionName), description: "Archived Teacher assignment for future Curriculum Offering Term.", metadata: { source: "TeachingMatrix" } });
          }
        }
      }
      if (audits.length) {
        const batchId = crypto.randomUUID();
        audits.push({ userId: session.user.id, action: validated.action, module: "SubjectAssignmentBulk", recordId: batchId, recordName: "Teaching matrix batch", description: `Applied ${audits.length} teaching assignment mutation${audits.length === 1 ? "" : "s"}.`, metadata: { batchId, action: validated.action, count: audits.length, assignmentIds: changedAssignmentIds.slice(0, 100) } });
        await createAuditLogs(audits, transaction);
      }
      return { changedCount: changedAssignmentIds.length };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { conflict(error); }
}

export async function getSubjectAssignments(): Promise<SubjectAssignmentListItem[]> {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  return (await findAllSubjectAssignments()).map((assignment) => ({
    id: assignment.id, teacherId: assignment.teacherId, subjectOfferingId: assignment.subjectOfferingId, academicTermId: assignment.academicTermId, sectionId: assignment.sectionId,
    employeeNumber: assignment.teacher.employeeNumber, teacherFirstName: assignment.teacher.firstName, teacherMiddleName: assignment.teacher.middleName, teacherLastName: assignment.teacher.lastName,
    subjectOfferingCode: assignment.subjectOfferingTerm.subjectOffering.subjectCode, subjectOfferingDescription: assignment.subjectOfferingTerm.subjectOffering.subjectDescription,
    academicTermName: assignment.subjectOfferingTerm.academicTerm.name, academicTermPosition: assignment.subjectOfferingTerm.academicTerm.position,
    sectionGradeLevel: assignment.section.gradeLevel, sectionName: assignment.section.sectionName,
    academicYearLabel: assignment.subjectOfferingTerm.subjectOffering.academicYear.label, academicYearStatus: assignment.subjectOfferingTerm.subjectOffering.academicYear.status,
  }));
}

export async function getSubjectAssignmentHistory(
  query: SubjectAssignmentHistoryQuery,
): Promise<SubjectAssignmentHistoryPage> {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  const validated = SubjectAssignmentHistoryQuerySchema.parse(query);

  return prisma.$transaction(async (transaction) => {
    const totalCount = await countSubjectAssignmentHistory(validated, transaction);
    const pageCount = Math.ceil(totalCount / validated.pageSize);
    const page = Math.min(validated.page, Math.max(1, pageCount));
    const assignments = await findSubjectAssignmentHistory(
      validated,
      { skip: (page - 1) * validated.pageSize, take: validated.pageSize },
      transaction,
    );

    return {
      items: assignments.map((assignment) => ({
        id: assignment.id,
        status: assignment.deletedAt ? "ARCHIVED" as const : "ACTIVE" as const,
        academicYear: assignment.subjectOfferingTerm.subjectOffering.academicYear,
        term: assignment.subjectOfferingTerm.academicTerm,
        offering: {
          id: assignment.subjectOfferingTerm.subjectOffering.id,
          subjectCode: assignment.subjectOfferingTerm.subjectOffering.subjectCode,
          subjectDescription: assignment.subjectOfferingTerm.subjectOffering.subjectDescription,
          gradeLevel: assignment.subjectOfferingTerm.subjectOffering.gradeLevel,
        },
        section: assignment.section,
        teacher: {
          id: assignment.teacher.id,
          employeeNumber: assignment.teacher.employeeNumber,
          name: `${assignment.teacher.lastName}, ${assignment.teacher.firstName}${assignment.teacher.middleName ? ` ${assignment.teacher.middleName}` : ""}`,
        },
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
        deletedAt: assignment.deletedAt,
        changedAt: assignment.deletedAt ?? assignment.updatedAt,
      })),
      totalCount,
      page,
      pageSize: validated.pageSize,
      pageCount,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function getSubjectAssignmentHistoryFilterOptions(query: unknown) {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  const validated = SubjectAssignmentHistoryFilterOptionsQuerySchema.parse(query);
  const [academicYears, terms] = await findSubjectAssignmentHistoryFilterOptions(
    validated.academicYearId,
  );
  return { academicYears, terms };
}

export async function getSubjectAssignmentHistoryOptions(
  query: SubjectAssignmentHistoryOptionsQuery,
): Promise<SubjectAssignmentHistoryOption[]> {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  const validated = SubjectAssignmentHistoryOptionsQuerySchema.parse(query);
  const options = await findSubjectAssignmentHistoryOptions(validated);

  return options.map((option) => {
    if ("employeeNumber" in option) {
      const name = `${option.lastName}, ${option.firstName}${option.middleName ? ` ${option.middleName}` : ""}`;
      return {
        id: option.id,
        label: `${option.employeeNumber} · ${name}`,
        searchValue: `${option.employeeNumber} ${option.firstName} ${option.middleName ?? ""} ${option.lastName}`,
      };
    }

    if ("sectionName" in option) {
      return {
        id: option.id,
        label: `Grade ${option.gradeLevel} ${option.sectionName}`,
        searchValue: `${option.gradeLevel} ${option.sectionName}`,
      };
    }

    return {
      id: option.id,
      label: `${option.subjectCode} · ${option.subjectDescription}`,
      searchValue: `${option.subjectCode} ${option.subjectDescription}`,
    };
  });
}

export async function getSubjectAssignmentOptions() {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  const [teachers, sections, academicYears, scopes] = await Promise.all([findActiveTeachersForAssignment(), findActiveSectionsForAssignment(), findActiveAcademicYearsForAssignment(), findAssignmentScopes()]);
  return { teachers, sections, academicYears, scopes: scopes.map((scope) => ({ subjectOfferingId: scope.subjectOfferingId, academicTermId: scope.academicTermId, academicYearId: scope.subjectOffering.academicYearId, gradeLevel: scope.subjectOffering.gradeLevel, subjectCode: scope.subjectOffering.subjectCode, subjectDescription: scope.subjectOffering.subjectDescription, academicTermName: scope.academicTerm.name, academicTermPosition: scope.academicTerm.position, shsCurriculumStatus: scope.subjectOffering.shsContext?.curriculumStatus ?? null })) };
}

export async function getAssignmentMatrix(query: AssignmentMatrixQuery) {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  const validated = AssignmentMatrixQuerySchema.parse(query);
  return prisma.$transaction(async (transaction) => {
    const years = await findActiveAcademicYearsForMatrix(transaction);
    const academicYear = validated.academicYearId ? years.find((year) => year.id === validated.academicYearId) : years[0];
    if (!academicYear) throw new Error("Active Academic Year not found.");
    const [scopes, sections, loads] = await Promise.all([
      findAssignmentMatrixScopes(academicYear.id, validated.gradeLevel, transaction),
      findAssignmentMatrixSections(validated.gradeLevel, transaction),
      findAssignmentMatrixTeacherLoads(academicYear.id, transaction),
    ]);
    const assignments = await findAssignmentMatrixAssignments([...new Set(scopes.map((scope) => scope.subjectOfferingId))], [...new Set(scopes.map((scope) => scope.academicTermId))], sections.map((section) => section.id), transaction);
    const today = getPhilippineCalendarDate();
    const assignmentBySlot = new Map(assignments.map((assignment) => [`${assignment.subjectOfferingId}:${assignment.academicTermId}:${assignment.sectionId}`, assignment]));
    const offers = new Map<string, typeof scopes>();
    scopes.forEach((scope) => offers.set(scope.subjectOfferingId, [...(offers.get(scope.subjectOfferingId) ?? []), scope]));
    const terms = [...new Map(scopes.map((scope) => [scope.academicTermId, scope.academicTerm])).values()].sort((a, b) => a.position - b.position);
    let assignedScopes = 0;
    let protectedScopes = 0;
    let mixedCells = 0;
    const offerings = [...offers.values()].map((offeringScopes) => {
      const first = offeringScopes[0];
      const cells = sections.map((section) => {
        const termAssignments = offeringScopes.map((scope) => {
          const assignment = assignmentBySlot.get(`${scope.subjectOfferingId}:${scope.academicTermId}:${section.id}`) ?? null;
          const protectedOwnership = Boolean(assignment && scope.academicTerm.startDate.toISOString().slice(0, 10) <= today);
          if (assignment) assignedScopes += 1;
          if (protectedOwnership) protectedScopes += 1;
          return { academicTermId: scope.academicTermId, academicTermName: scope.academicTerm.name, academicTermPosition: scope.academicTerm.position, assignmentId: assignment?.id ?? null, teacher: assignment ? { id: assignment.teacher.id, employeeNumber: assignment.teacher.employeeNumber, name: `${assignment.teacher.lastName}, ${assignment.teacher.firstName}${assignment.teacher.middleName ? ` ${assignment.teacher.middleName}` : ""}` } : null, termHasStarted: scope.academicTerm.startDate.toISOString().slice(0, 10) <= today, initialAssignmentAllowed: !assignment, ownershipEditable: !protectedOwnership, protectedOwnership };
        });
        const assigned = termAssignments.filter((term) => term.assignmentId);
        const teachers = new Set(assigned.map((term) => term.teacher?.id));
        const state = assigned.length === 0 ? "UNASSIGNED" : assigned.length === termAssignments.length && teachers.size === 1 ? "SINGLE_TEACHER" : "MIXED_BY_TERM";
        if (state === "MIXED_BY_TERM") mixedCells += 1;
        return { sectionId: section.id, state, termAssignments };
      });
      return { id: first.subjectOffering.id, subjectCode: first.subjectOffering.subjectCode, subjectDescription: first.subjectOffering.subjectDescription, applicableTerms: offeringScopes.map((scope) => ({ id: scope.academicTermId, name: scope.academicTerm.name, position: scope.academicTerm.position })), cells };
    });
    const loadByTeacher = new Map<string, { teacher: (typeof loads)[number]["teacher"]; scopes: number; offerings: Set<string>; sections: Set<string>; terms: Map<string, { scopes: number; offerings: Set<string>; sections: Set<string> }> }>();
    loads.forEach((load) => {
      if (load.teacher.deletedAt || load.teacher.status !== "ACTIVE") return;
      const value = loadByTeacher.get(load.teacherId) ?? { teacher: load.teacher, scopes: 0, offerings: new Set(), sections: new Set(), terms: new Map() };
      const term = value.terms.get(load.academicTermId) ?? { scopes: 0, offerings: new Set(), sections: new Set() };
      value.scopes += 1; value.offerings.add(load.subjectOfferingId); value.sections.add(load.sectionId); term.scopes += 1; term.offerings.add(load.subjectOfferingId); term.sections.add(load.sectionId); value.terms.set(load.academicTermId, term); loadByTeacher.set(load.teacherId, value);
    });
    return { academicYear, gradeLevel: validated.gradeLevel, terms, sections, offerings, coverage: { expectedScopes: scopes.length * sections.length, assignedScopes, missingScopes: scopes.length * sections.length - assignedScopes, fullyCoveredCells: offerings.reduce((count, offering) => count + offering.cells.filter((cell) => cell.state === "SINGLE_TEACHER" || cell.termAssignments.every((term) => term.assignmentId)).length, 0), mixedCells, protectedScopes }, teacherLoads: [...loadByTeacher.values()].map((value) => ({ teacherId: value.teacher.id, employeeNumber: value.teacher.employeeNumber, name: `${value.teacher.lastName}, ${value.teacher.firstName}`, activeAssignmentScopeCount: value.scopes, distinctOfferingCount: value.offerings.size, distinctSectionCount: value.sections.size, termLoads: [...value.terms.entries()].map(([academicTermId, term]) => ({ academicTermId, assignmentScopeCount: term.scopes, distinctOfferingCount: term.offerings.size, distinctSectionCount: term.sections.size })) })).sort((a, b) => a.name.localeCompare(b.name)) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function createSubjectAssignmentService(values: Values) {
  const session = await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  try { return await prisma.$transaction(async (transaction) => {
    const { section, scope } = await validateValues(values, transaction);
    const existing = await findActiveSubjectAssignment({ subjectOfferingId: values.subjectOfferingId, academicTermId: values.academicTermId, sectionId: values.sectionId }, transaction);
    if (existing) throw new Error("An active Teacher assignment already exists for this Curriculum Offering Term and Section.");
    const assignment = await createSubjectAssignment(values, transaction);
    await createAuditLogs([{ userId: session.user.id, action: "CREATE", module: "SubjectAssignment", recordId: assignment.id, recordName: slotName(scope, section.sectionName), description: "Created Teacher assignment for Curriculum Offering Term." }], transaction);
    return assignment;
  }); } catch (error) { conflict(error); }
}

export async function updateSubjectAssignmentService(id: string, values: z.infer<typeof UpdateSubjectAssignmentSchema>) {
  const session = await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  try { return await prisma.$transaction(async (transaction) => {
    const assignment = await findActiveSubjectAssignmentById(id, transaction);
    if (!assignment) throw new Error("Subject assignment not found.");
    if (!isAcademicYearWritable(assignment.subjectOfferingTerm.subjectOffering.academicYear.status)) throw new Error("Subject assignments can only be updated while their Academic Year is active.");
    if (termHasStarted(assignment.subjectOfferingTerm.academicTerm.startDate)) throw new Error("This Term has started. Use a controlled reassignment/correction workflow to change teaching ownership.");
    const { section, scope } = await validateValues(values, transaction);
    const existing = await findActiveSubjectAssignment({ subjectOfferingId: values.subjectOfferingId, academicTermId: values.academicTermId, sectionId: values.sectionId }, transaction);
    if (existing && existing.id !== id) throw new Error("An active Teacher assignment already exists for this Curriculum Offering Term and Section.");
    const updated = await updateSubjectAssignment(id, values, transaction);
    await createAuditLogs([{ userId: session.user.id, action: "UPDATE", module: "SubjectAssignment", recordId: updated.id, recordName: slotName(scope, section.sectionName), description: "Updated Teacher assignment for Curriculum Offering Term." }], transaction);
    return updated;
  }); } catch (error) { conflict(error); }
}

export async function archiveSubjectAssignmentService(id: string) {
  const session = await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  return prisma.$transaction(async (transaction) => {
    const assignment = await findActiveSubjectAssignmentById(id, transaction);
    if (!assignment) throw new Error("Subject assignment not found.");
    if (!isAcademicYearWritable(assignment.subjectOfferingTerm.subjectOffering.academicYear.status)) throw new Error("Subject assignments can only be archived while their Academic Year is active.");
    if (termHasStarted(assignment.subjectOfferingTerm.academicTerm.startDate)) throw new Error("This Term has started. Use a controlled reassignment/correction workflow to change teaching ownership.");
    const archived = await archiveSubjectAssignment(id, transaction);
    await createAuditLogs([{ userId: session.user.id, action: "ARCHIVE", module: "SubjectAssignment", recordId: archived.id, recordName: `${assignment.subjectOfferingTerm.subjectOffering.subjectCode} - ${assignment.subjectOfferingTerm.academicTerm.name} - ${assignment.section.sectionName}`, description: "Archived Teacher assignment for future Curriculum Offering Term." }], transaction);
    return archived;
  });
}
