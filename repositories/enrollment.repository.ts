import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

interface EnrollmentIdentity {
  studentId: string;
  academicYear: string;
}

export async function findNonArchivedEnrollments() {
  return prisma.enrollment.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      studentId: true,
      sectionId: true,
      academicYear: true,
      semester: true,
      status: true,
      student: {
        select: {
          lrn: true,
          firstName: true,
          middleName: true,
          lastName: true,
        },
      },
      section: {
        select: {
          gradeLevel: true,
          trackStrand: true,
          sectionName: true,
        },
      },
    },
    orderBy: [
      {
        academicYear: "desc",
      },
      {
        student: {
          lastName: "asc",
        },
      },
      {
        student: {
          firstName: "asc",
        },
      },
      {
        student: {
          lrn: "asc",
        },
      },
    ],
  });
}

export async function findEnrollmentByIdentity(
  identity: EnrollmentIdentity,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).enrollment.findUnique({
    where: {
      studentId_academicYear: identity,
    },
    select: {
      id: true,
    },
  });
}

export async function createEnrollment(
  data: Prisma.EnrollmentUncheckedCreateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).enrollment.create({
    data,
  });
}
