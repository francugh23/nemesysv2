import prisma from "@/lib/prisma";

import { Prisma } from "@/app/generated/prisma/client";

export async function findStudents() {
  return prisma.student.findMany({
    where: {
      deletedAt: null,
    },
    include: {
      currentSection: {
        select: {
          id: true,
          gradeLevel: true,
          trackStrand: true,
          sectionName: true,
          room: true,
          shift: true,
          adviser: {
            select: {
              user: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
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

export async function findActiveStudentsForEnrollment() {
  return prisma.student.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      lrn: true,
      firstName: true,
      middleName: true,
      lastName: true,
    },
    orderBy: [
      {
        lastName: "asc",
      },
      {
        firstName: "asc",
      },
      {
        lrn: "asc",
      },
    ],
  });
}

export async function findActiveStudentForEnrollment(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).student.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      lrn: true,
      firstName: true,
      middleName: true,
      lastName: true,
      status: true,
      currentSectionId: true,
      currentSection: {
        select: {
          gradeLevel: true,
          trackStrand: true,
          sectionName: true,
        },
      },
    },
  });
}

export async function updateStudentEnrollmentSummary(
  id: string,
  data: Pick<
    Prisma.StudentUncheckedUpdateInput,
    "status" | "currentSectionId"
  >,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).student.update({
    where: {
      id,
    },
    data,
    select: {
      status: true,
      currentSectionId: true,
    },
  });
}

export async function lockStudentForEnrollmentSynchronization(
  id: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT "id"
    FROM "Student"
    WHERE "id" = ${id}
    FOR UPDATE
  `);
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

export async function findStudentsByLRNs(lrns: string[]) {
  return prisma.student.findMany({
    where: {
      lrn: {
        in: lrns,
      },
    },
    select: {
      lrn: true,
    },
  });
}

export async function createStudents(
  data: Prisma.StudentCreateManyInput[],
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).student.createMany({
    data,
  });
}
