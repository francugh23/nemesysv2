import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export async function findTeachers() {
  return prisma.teacher.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      degree: true,
      major: true,
      isAdviser: true,
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
