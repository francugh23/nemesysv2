import prisma from "@/lib/prisma";

import { Prisma } from "@/app/generated/prisma/client";

export async function findStudents() {
  return prisma.student.findMany({
    where: {
      deletedAt: null,
    },

    orderBy: [
      {
        lastName: "asc",
      },
      {
        firstName: "asc",
      },
    ],
  });
}

export async function createStudent(data: Prisma.StudentCreateInput) {
  return prisma.student.create({
    data,
  });
}

export async function updateStudent(
  id: string,
  data: Prisma.StudentUpdateInput,
) {
  return prisma.student.update({
    where: {
      id,
    },

    data,
  });
}

export async function softDeleteStudent(id: string) {
  return prisma.student.update({
    where: {
      id,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}

export async function findStudentByLRN(lrn: string) {
  return prisma.student.findUnique({
    where: {
      lrn,
    },
  });
}
