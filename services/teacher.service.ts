import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import { archiveTeacher, countNonArchivedTeachers, createTeacher, deactivateTeacher, findNonArchivedTeachers, findTeacherByEmployeeNumber, findTeacherById, findTeacherFilterOptionValues, findTeachersByEmail, hasActiveTeacherDependencies, updateTeacher } from "@/repositories/teacher.repository";
import { CreateTeacherSchema, type TeacherFilterOptions, type TeacherPage, type TeacherTableQuery, UpdateTeacherSchema } from "@/schemas";
import { z } from "zod";

function canonicalEmployeeNumber(value: string) { return value.trim().toUpperCase(); }
function canonicalEmail(value?: string) { const normalized = value?.trim().toLowerCase(); return normalized || null; }
function nameOf(teacher: { lastName: string; firstName: string }) { return `${teacher.lastName}, ${teacher.firstName}`; }

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

export { canonicalEmail, canonicalEmployeeNumber };
