import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export interface TeacherListFilters {
  search?: string;
  status?: "ACTIVE" | "INACTIVE";
  gender?: "MALE" | "FEMALE";
}

const teacherListSelect = {
  id: true,
  degree: true,
  major: true,
  isAdviser: true,
  createdAt: true,
  user: {
    select: {
      employeeNumber: true,
      username: true,
      email: true,
      firstName: true,
      middleName: true,
      lastName: true,
      gender: true,
      status: true,
    },
  },
} satisfies Prisma.TeacherSelect;

function getTeacherListWhere(
  filters: TeacherListFilters,
): Prisma.TeacherWhereInput {
  const searchTerms = filters.search?.split(/\s+/).filter(Boolean) ?? [];

  return {
    deletedAt: null,
    user: {
      is: {
        deletedAt: null,
        status: filters.status,
        gender: filters.gender,
        AND: searchTerms.map((term) => ({
          OR: [
            { employeeNumber: { contains: term, mode: "insensitive" } },
            { firstName: { contains: term, mode: "insensitive" } },
            { middleName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
          ],
        })),
      },
    },
  };
}

export async function countNonArchivedTeachers(filters: TeacherListFilters) {
  return prisma.teacher.count({
    where: getTeacherListWhere(filters),
  });
}

export async function findNonArchivedTeachers(
  filters: TeacherListFilters,
  pagination: { skip: number; take: number },
  orderBy: Prisma.TeacherOrderByWithRelationInput[],
) {
  return prisma.teacher.findMany({
    where: getTeacherListWhere(filters),
    select: teacherListSelect,
    orderBy,
    skip: pagination.skip,
    take: pagination.take,
  });
}

export async function findTeacherFilterOptionValues() {
  return prisma.teacher.findMany({
    where: {
      deletedAt: null,
      user: {
        is: {
          deletedAt: null,
        },
      },
    },
    select: {
      user: {
        select: {
          status: true,
          gender: true,
        },
      },
    },
  });
}

export async function createTeacher(
  data: Prisma.TeacherUncheckedCreateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).teacher.create({
    data,
  });
}

export async function findTeacherById(id: string) {
  return prisma.teacher.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
    },
  });
}

export async function findActiveTeacherForAssignment(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).teacher.findFirst({
    where: {
      id,
      deletedAt: null,
      user: {
        is: {
          deletedAt: null,
          status: "ACTIVE",
        },
      },
    },
    select: {
      id: true,
      user: {
        select: {
          employeeNumber: true,
          firstName: true,
          middleName: true,
          lastName: true,
        },
      },
    },
  });
}

export async function findActiveTeachersForAssignment() {
  return prisma.teacher.findMany({
    where: {
      deletedAt: null,
      user: {
        is: {
          deletedAt: null,
          status: "ACTIVE",
        },
      },
    },
    select: {
      id: true,
      user: {
        select: {
          employeeNumber: true,
          firstName: true,
          middleName: true,
          lastName: true,
        },
      },
    },
    orderBy: [
      {
        user: {
          lastName: "asc",
        },
      },
      {
        user: {
          firstName: "asc",
        },
      },
    ],
  });
}

export async function findActiveTeacherForSection(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return findActiveTeacherForAssignment(id, transaction);
}

export async function findActiveTeachersForSection() {
  return findActiveTeachersForAssignment();
}

export async function updateTeacher(
  id: string,
  data: Prisma.TeacherUpdateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).teacher.update({
    where: {
      id,
    },
    data,
  });
}

export async function softDeleteTeacher(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).teacher.update({
    where: {
      id,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}
