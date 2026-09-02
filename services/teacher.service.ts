import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import { canonicalEmail, canonicalEmployeeNumber } from "@/lib/teacher-identity";
import prisma from "@/lib/prisma";
import { classifyTeacherImportRows } from "@/lib/teacher-import-preview";
import { teacherImportTemplateDefinition } from "@/lib/import/definitions/teacher-import-template.definition";
import { normalizeTeacherImportRow } from "@/lib/teacher-import-normalizer";
import { createAuditLogs } from "@/repositories/audit.repository";
import { archiveTeacher, countNonArchivedTeachers, createTeacher, deactivateTeacher, findNonArchivedTeachers, findTeacherByEmployeeNumber, findTeacherById, findTeacherFilterOptionValues, findTeachersByEmail, findTeachersForImport, hasActiveTeacherDependencies, updateTeacher } from "@/repositories/teacher.repository";
import { CreateTeacherSchema, type TeacherFilterOptions, type TeacherPage, type TeacherTableQuery, UpdateTeacherSchema } from "@/schemas";
import { generateImportTemplate } from "@/services/import-template.service";
import { randomUUID } from "node:crypto";
import { z } from "zod";

function nameOf(teacher: { lastName: string; firstName: string }) { return `${teacher.lastName}, ${teacher.firstName}`; }

const TEACHER_IMPORT_BATCH_SIZE = 100;

function chunks<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}

async function getTeacherImportPreview(rows: Record<string, unknown>[], page: number, transaction?: Prisma.TransactionClient) {
  const normalizedRows = rows.map(normalizeTeacherImportRow);
  const parsedRows = normalizedRows.map((row) => CreateTeacherSchema.safeParse(row));
  const employeeNumbers = parsedRows.flatMap((parsed) => parsed.success ? [parsed.data.employeeNumber] : []);
  const emails = parsedRows.flatMap((parsed) => parsed.success && canonicalEmail(parsed.data.email) ? [canonicalEmail(parsed.data.email)!] : []);
  const teachers = await findTeachersForImport(employeeNumbers, emails, transaction);
  return classifyTeacherImportRows(rows, teachers, page);
}

function getTeacherOrderBy(query: TeacherTableQuery): Prisma.TeacherOrderByWithRelationInput[] {
  const direction = query.direction ?? "asc";
  switch (query.sort) {
    case "employeeNumber": return [{ employeeNumber: direction }, { id: "asc" }];
    case "lastName": return [{ lastName: direction }, { id: "asc" }];
    case "firstName": return [{ firstName: direction }, { id: "asc" }];
    case "middleName": return [{ middleName: direction }, { id: "asc" }];
    case "gender": return [{ gender: direction }, { id: "asc" }];
    case "degree": return [{ degree: direction }, { id: "asc" }];
    case "major": return [{ major: direction }, { id: "asc" }];
    case "status": return [{ status: direction }, { id: "asc" }];
    case "createdAt": return [{ createdAt: direction }, { id: "asc" }];
    default: return [{ lastName: "asc" }, { firstName: "asc" }, { middleName: "asc" }, { employeeNumber: "asc" }, { id: "asc" }];
  }
}

function listItem(teacher: Awaited<ReturnType<typeof findNonArchivedTeachers>>[number]) {
  return { ...teacher, hasLinkedAccount: teacher.userId !== null, activeSubjectAssignmentCount: teacher._count.subjectAssignments, activeAdvisedSectionCount: teacher._count.advisedSections, _count: undefined };
}

async function validateIdentity(values: z.infer<typeof CreateTeacherSchema>, existingId?: string, transaction?: Prisma.TransactionClient) {
  const employeeNumber = canonicalEmployeeNumber(values.employeeNumber);
  const employeeMatch = await findTeacherByEmployeeNumber(employeeNumber, transaction);
  if (employeeMatch && employeeMatch.id !== existingId) throw new Error("Employee number already exists.");
  const email = canonicalEmail(values.email);
  if (email) {
    const emailMatches = await findTeachersByEmail(email, transaction);
    if (emailMatches.some((teacher) => teacher.id !== existingId)) throw new Error("Teacher email already exists and requires review.");
  }
  return { employeeNumber, email };
}

function dependencyError(dependencies: { activeSubjectAssignmentCount: number; activeAdvisedSectionCount: number }) {
  if (dependencies.activeSubjectAssignmentCount) return "Teacher has active Subject Assignments. Resolve them through the Assignment workflow first.";
  if (dependencies.activeAdvisedSectionCount) return "Teacher is adviser of an active Section. Resolve it through the Section workflow first.";
  return null;
}

export async function getTeachers(query: TeacherTableQuery): Promise<TeacherPage> {
  await requirePermission(Permissions.TEACHERS);
  const filters = { search: query.q, status: query.status, gender: query.gender, adviser: query.adviser === "true" ? true : query.adviser === "false" ? false : undefined };
  const totalCount = await countNonArchivedTeachers(filters);
  const pageCount = Math.ceil(totalCount / query.pageSize);
  const page = Math.min(query.page, Math.max(pageCount, 1));
  const teachers = await findNonArchivedTeachers(filters, { skip: (page - 1) * query.pageSize, take: query.pageSize }, getTeacherOrderBy(query));
  return { items: teachers.map(listItem), totalCount, page, pageSize: query.pageSize, pageCount };
}

export async function getTeacherFilterOptions(): Promise<TeacherFilterOptions> {
  await requirePermission(Permissions.TEACHERS);
  const values = await findTeacherFilterOptionValues();
  return { statuses: [...new Set(values.map((value) => value.status))].sort((a, b) => ["ACTIVE", "INACTIVE"].indexOf(a) - ["ACTIVE", "INACTIVE"].indexOf(b)), genders: [...new Set(values.map((value) => value.gender))].sort((a, b) => ["MALE", "FEMALE"].indexOf(a) - ["MALE", "FEMALE"].indexOf(b)) };
}

export async function createTeacherService(values: z.infer<typeof CreateTeacherSchema>) {
  const session = await requirePermission(Permissions.TEACHERS);
  return prisma.$transaction(async (transaction) => {
    const identity = await validateIdentity(values, undefined, transaction);
    const teacher = await createTeacher({ ...values, ...identity, middleName: values.middleName?.trim() || null, degree: values.degree?.trim() || null, major: values.major?.trim() || null }, transaction);
    await createAuditLogs([{ userId: session.user.id, action: "CREATE", module: "Teacher", recordId: teacher.id, recordName: nameOf(teacher), description: "Created teacher personnel profile" }], transaction);
    return teacher;
  });
}

export async function updateTeacherService(id: string, values: z.infer<typeof UpdateTeacherSchema>) {
  const session = await requirePermission(Permissions.TEACHERS);
  return prisma.$transaction(async (transaction) => {
    const teacher = await findTeacherById(id, transaction);
    if (!teacher) throw new Error("Teacher not found.");
    const identity = await validateIdentity(values, teacher.id, transaction);
    const updatedTeacher = await updateTeacher(teacher.id, { ...values, ...identity, middleName: values.middleName?.trim() || null, degree: values.degree?.trim() || null, major: values.major?.trim() || null }, transaction);
    await createAuditLogs([{ userId: session.user.id, action: "UPDATE", module: "Teacher", recordId: updatedTeacher.id, recordName: nameOf(updatedTeacher), description: "Updated teacher personnel profile" }], transaction);
    return updatedTeacher;
  });
}

export async function deactivateTeacherService(id: string) {
  const session = await requirePermission(Permissions.TEACHERS);
  return prisma.$transaction(async (transaction) => {
    const teacher = await findTeacherById(id, transaction);
    if (!teacher) throw new Error("Teacher not found.");
    if (teacher.status === "INACTIVE") throw new Error("Teacher is already inactive.");
    const blocker = dependencyError(await hasActiveTeacherDependencies(teacher.id, transaction));
    if (blocker) throw new Error(blocker);
    const deactivated = await deactivateTeacher(teacher.id, transaction);
    await createAuditLogs([{ userId: session.user.id, action: "DEACTIVATE", module: "Teacher", recordId: deactivated.id, recordName: nameOf(deactivated), description: "Deactivated teacher personnel profile" }], transaction);
    return deactivated;
  });
}

export async function archiveTeacherService(id: string) {
  const session = await requirePermission(Permissions.TEACHERS);
  return prisma.$transaction(async (transaction) => {
    const teacher = await findTeacherById(id, transaction);
    if (!teacher) throw new Error("Teacher not found.");
    const blocker = dependencyError(await hasActiveTeacherDependencies(teacher.id, transaction));
    if (blocker) throw new Error(blocker);
    const archived = await archiveTeacher(teacher.id, transaction);
    await createAuditLogs([{ userId: session.user.id, action: "ARCHIVE", module: "Teacher", recordId: archived.id, recordName: nameOf(archived), description: "Archived teacher personnel profile" }], transaction);
    return archived;
  });
}

export async function getTeacherImportTemplate() {
  await requirePermission(Permissions.TEACHERS);
  return generateImportTemplate(teacherImportTemplateDefinition);
}

export async function previewTeacherImportService(rows: Record<string, unknown>[], page = 1) {
  await requirePermission(Permissions.TEACHERS);
  if (!rows.length || rows.length > 500) throw new Error("Teacher imports must contain between 1 and 500 rows.");
  return getTeacherImportPreview(rows, page);
}

function isImportRaceError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034");
}

export async function confirmTeacherImportService(rows: Record<string, unknown>[]) {
  const session = await requirePermission(Permissions.TEACHERS);
  if (!rows.length || rows.length > 500) throw new Error("Teacher imports must contain between 1 and 500 rows.");
  const batchId = randomUUID();
  try {
    return await prisma.$transaction(async (transaction) => {
      const preview = await getTeacherImportPreview(rows, 1, transaction);
      if (!preview.canImport) throw new Error("Teacher import contains invalid or conflicting rows. No Teachers were imported.");
      const normalizedRows = rows.map(normalizeTeacherImportRow);
      const validatedRows = normalizedRows.map((row) => CreateTeacherSchema.parse(row));
      const teachers = [];
      for (const batch of chunks(validatedRows, TEACHER_IMPORT_BATCH_SIZE)) {
        const created = await Promise.all(batch.map((row) => createTeacher({
          ...row,
          employeeNumber: canonicalEmployeeNumber(row.employeeNumber),
          email: canonicalEmail(row.email),
          middleName: row.middleName?.trim() || null,
          degree: row.degree?.trim() || null,
          major: row.major?.trim() || null,
          status: "ACTIVE",
          userId: null,
        }, transaction)));
        teachers.push(...created);
      }
      await createAuditLogs(teachers.map((teacher) => ({
        userId: session.user.id,
        action: "CREATE",
        module: "Teacher",
        recordId: teacher.id,
        recordName: nameOf(teacher),
        description: "Created teacher personnel profile from batch import",
        metadata: { source: "TEACHER_IMPORT", batchId },
      })), transaction);
      await createAuditLogs([{
        userId: session.user.id,
        action: "CREATE",
        module: "TeacherImport",
        recordId: batchId,
        recordName: "Teacher import",
        description: `Imported ${teachers.length} teacher personnel profiles`,
        metadata: { batchId, count: teachers.length },
      }], transaction);
      return { importedCount: teachers.length, batchId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (isImportRaceError(error)) throw new Error("Teacher import conflicts with an existing employee number or email. No Teachers were imported.");
    throw error;
  }
}

export { canonicalEmail, canonicalEmployeeNumber } from "@/lib/teacher-identity";
