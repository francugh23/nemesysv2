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
      createdAt: true,
      updatedAt: true,
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

export async function findActiveEnrollmentById(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).enrollment.findFirst({
    where: {
      id,
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
      },
      section: {
        select: {
          gradeLevel: true,
          trackStrand: true,
          sectionName: true,
        },
      },
    },
  });
}

export async function updateEnrollment(
  where: Prisma.EnrollmentWhereInput,
  data: Prisma.EnrollmentUncheckedUpdateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).enrollment.updateMany({
    where,
    data,
  });
}

export async function findLatestActiveEnrollmentByStudent(
  studentId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).enrollment.findFirst({
    where: {
      studentId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      sectionId: true,
      section: {
        select: {
          gradeLevel: true,
          trackStrand: true,
          sectionName: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
}

export async function findLatestTerminalEnrollmentByStudent(
  studentId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).enrollment.findFirst({
    where: {
      studentId,
      status: {
        in: ["COMPLETED", "DROPPED", "TRANSFERRED"],
      },
      deletedAt: null,
    },
    select: {
      status: true,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
}
