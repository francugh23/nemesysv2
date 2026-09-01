import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

export interface TeacherListFilters {
  search?: string;
  status?: "ACTIVE" | "INACTIVE";
  gender?: "MALE" | "FEMALE";
  adviser?: boolean;
}

const teacherListSelect = {
  id: true,
  employeeNumber: true,
  firstName: true,
  middleName: true,
  lastName: true,
  gender: true,
  email: true,
  degree: true,
  major: true,
  status: true,
  createdAt: true,
  userId: true,
  _count: {
    select: {
      subjectAssignments: { where: { deletedAt: null } },
      advisedSections: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.TeacherSelect;

function getTeacherListWhere(filters: TeacherListFilters): Prisma.TeacherWhereInput {
  const searchTerms = filters.search?.split(/\s+/).filter(Boolean) ?? [];
  const adviserWhere = filters.adviser === undefined ? undefined : filters.adviser
    ? { some: { deletedAt: null } }
    : { none: { deletedAt: null } };

  return {
    deletedAt: null,
    status: filters.status,
    gender: filters.gender,
    advisedSections: adviserWhere,
    AND: searchTerms.map((term) => ({
      OR: [
        { employeeNumber: { contains: term, mode: "insensitive" } },
        { firstName: { contains: term, mode: "insensitive" } },
        { middleName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ],
    })),
  };
}

export async function countNonArchivedTeachers(filters: TeacherListFilters) {
  return prisma.teacher.count({ where: getTeacherListWhere(filters) });
}

export async function findNonArchivedTeachers(filters: TeacherListFilters, pagination: { skip: number; take: number }, orderBy: Prisma.TeacherOrderByWithRelationInput[]) {
  return prisma.teacher.findMany({ where: getTeacherListWhere(filters), select: teacherListSelect, orderBy, skip: pagination.skip, take: pagination.take });
}

export async function findTeacherFilterOptionValues() {
  return prisma.teacher.findMany({ where: { deletedAt: null }, select: { status: true, gender: true } });
}

export async function createTeacher(data: Prisma.TeacherUncheckedCreateInput, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).teacher.create({ data });
}

export async function findTeacherById(id: string, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).teacher.findFirst({ where: { id, deletedAt: null }, select: { id: true, employeeNumber: true, status: true, userId: true } });
}

export async function findTeacherByEmployeeNumber(employeeNumber: string, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).teacher.findUnique({ where: { employeeNumber }, select: { id: true, deletedAt: true } });
}

export async function findTeachersByEmail(email: string, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).teacher.findMany({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true, deletedAt: true } });
}

export async function findActiveTeacherForAssignment(id: string, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).teacher.findFirst({ where: { id, deletedAt: null, status: "ACTIVE" }, select: { id: true, employeeNumber: true, firstName: true, middleName: true, lastName: true } });
}

export async function findActiveTeachersForAssignment() {
  return prisma.teacher.findMany({ where: { deletedAt: null, status: "ACTIVE" }, select: { id: true, employeeNumber: true, firstName: true, middleName: true, lastName: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }] });
}

export async function findActiveTeacherForSection(id: string, transaction?: Prisma.TransactionClient) {
  return findActiveTeacherForAssignment(id, transaction);
}

export async function findActiveTeachersForSection() {
  return findActiveTeachersForAssignment();
}

export async function hasActiveTeacherDependencies(id: string, transaction?: Prisma.TransactionClient) {
  const teacher = await (transaction ?? prisma).teacher.findUnique({ where: { id }, select: { _count: { select: { subjectAssignments: { where: { deletedAt: null } }, advisedSections: { where: { deletedAt: null } } } } } });
  return { activeSubjectAssignmentCount: teacher?._count.subjectAssignments ?? 0, activeAdvisedSectionCount: teacher?._count.advisedSections ?? 0 };
}

export async function updateTeacher(id: string, data: Prisma.TeacherUpdateInput, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).teacher.update({ where: { id }, data });
}

export async function deactivateTeacher(id: string, transaction?: Prisma.TransactionClient) {
  return updateTeacher(id, { status: "INACTIVE" }, transaction);
}

export async function archiveTeacher(id: string, transaction?: Prisma.TransactionClient) {
  return updateTeacher(id, { deletedAt: new Date() }, transaction);
}
