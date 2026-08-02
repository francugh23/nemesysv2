import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

interface SubjectAssignmentIdentity {
  teacherId: string;
  subjectId: string;
  sectionId: string;
  academicYear: string;
}

export async function findActiveSubjectAssignment(
  identity: SubjectAssignmentIdentity,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subjectAssignment.findFirst({
    where: {
      ...identity,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });
}

export async function findActiveSubjectAssignmentById(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subjectAssignment.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });
}

export async function findActiveSubjectAssignmentExcludingId(
  identity: SubjectAssignmentIdentity,
  excludeId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subjectAssignment.findFirst({
    where: {
      ...identity,
      id: {
        not: excludeId,
      },
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });
}

export async function createSubjectAssignment(
  data: Prisma.SubjectAssignmentUncheckedCreateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subjectAssignment.create({
    data,
  });
}

export async function updateSubjectAssignment(
  id: string,
  data: Prisma.SubjectAssignmentUncheckedUpdateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subjectAssignment.update({
    where: {
      id,
    },
    data,
  });
}

export async function findAllSubjectAssignments() {
  return prisma.subjectAssignment.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      teacherId: true,
      subjectId: true,
      sectionId: true,
      academicYear: true,
      teacher: {
        select: {
          user: {
            select: {
              employeeNumber: true,
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
      },
      subject: {
        select: {
          code: true,
          description: true,
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
        section: {
          sectionName: "asc",
        },
      },
      {
        subject: {
          code: "asc",
        },
      },
      {
        teacher: {
          user: {
            lastName: "asc",
          },
        },
      },
      {
        teacher: {
          user: {
            firstName: "asc",
          },
        },
      },
    ],
  });
}
