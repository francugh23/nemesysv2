import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import { isAcademicYearWritable } from "@/lib/academic-year";
import { getPhilippineCalendarDate } from "@/lib/academic-term-current";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import { findActiveSectionForAssignment, findActiveSectionsForAssignment } from "@/repositories/section.repository";
import { findActiveTeacherForAssignment, findActiveTeachersForAssignment } from "@/repositories/teacher.repository";
import { archiveSubjectAssignment, createSubjectAssignment, findActiveAcademicYearsForAssignment, findActiveAcademicYearsForMatrix, findActiveSubjectAssignment, findActiveSubjectAssignmentById, findAllSubjectAssignments, findAssignmentMatrixAssignments, findAssignmentMatrixScopes, findAssignmentMatrixSections, findAssignmentMatrixTeacherLoads, findAssignmentScope, findAssignmentScopes, updateSubjectAssignment } from "@/repositories/subject-assignment.repository";
import { AssignmentMatrixQuerySchema, CreateSubjectAssignmentSchema, type AssignmentMatrixQuery, type SubjectAssignmentListItem, UpdateSubjectAssignmentSchema } from "@/schemas";
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
  throw error;
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
          return { academicTermId: scope.academicTermId, academicTermName: scope.academicTerm.name, academicTermPosition: scope.academicTerm.position, assignmentId: assignment?.id ?? null, teacher: assignment ? { id: assignment.teacher.id, employeeNumber: assignment.teacher.employeeNumber, name: `${assignment.teacher.lastName}, ${assignment.teacher.firstName}${assignment.teacher.middleName ? ` ${assignment.teacher.middleName}` : ""}` } : null, initialAssignmentAllowed: !assignment, ownershipEditable: !protectedOwnership, protectedOwnership };
        });
        const assigned = termAssignments.filter((term) => term.assignmentId);
        const teachers = new Set(assigned.map((term) => term.teacher?.id));
        const state = assigned.length === 0 ? "UNASSIGNED" : assigned.length === termAssignments.length && teachers.size === 1 ? "SINGLE_TEACHER" : "MIXED_BY_TERM";
        if (state === "MIXED_BY_TERM") mixedCells += 1;
        return { sectionId: section.id, state, termAssignments };
      });
      return { id: first.subjectOffering.id, subjectCode: first.subjectOffering.subjectCode, subjectDescription: first.subjectOffering.subjectDescription, applicableTerms: offeringScopes.map((scope) => ({ id: scope.academicTermId, name: scope.academicTerm.name, position: scope.academicTerm.position })), cells };
    });
    const currentTermIds = new Set(terms.filter((term) => term.startDate.toISOString().slice(0, 10) <= today).map((term) => term.id));
    const loadByTeacher = new Map<string, { teacher: (typeof loads)[number]["teacher"]; scopes: number; current: number; offerings: Set<string>; sections: Set<string> }>();
    loads.forEach((load) => {
      if (load.teacher.deletedAt || load.teacher.status !== "ACTIVE") return;
      const value = loadByTeacher.get(load.teacherId) ?? { teacher: load.teacher, scopes: 0, current: 0, offerings: new Set(), sections: new Set() };
      value.scopes += 1; if (currentTermIds.has(load.academicTermId)) value.current += 1; value.offerings.add(load.subjectOfferingId); value.sections.add(load.sectionId); loadByTeacher.set(load.teacherId, value);
    });
    return { academicYear, gradeLevel: validated.gradeLevel, terms, sections, offerings, coverage: { expectedScopes: scopes.length * sections.length, assignedScopes, missingScopes: scopes.length * sections.length - assignedScopes, fullyCoveredCells: offerings.reduce((count, offering) => count + offering.cells.filter((cell) => cell.state === "SINGLE_TEACHER" || cell.termAssignments.every((term) => term.assignmentId)).length, 0), mixedCells, protectedScopes }, teacherLoads: [...loadByTeacher.values()].map((value) => ({ teacherId: value.teacher.id, employeeNumber: value.teacher.employeeNumber, name: `${value.teacher.lastName}, ${value.teacher.firstName}`, activeAssignmentScopeCount: value.scopes, currentTermAssignmentScopeCount: value.current, distinctOfferingCount: value.offerings.size, distinctSectionCount: value.sections.size })).sort((a, b) => a.name.localeCompare(b.name)) };
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
