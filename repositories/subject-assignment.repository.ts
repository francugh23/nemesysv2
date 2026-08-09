import prisma from "@/lib/prisma";
import {
  Prisma,
  type AcademicYearStatus,
} from "@/app/generated/prisma/client";

interface SubjectAssignmentIdentity {
  teacherId: string;
  subjectId: string;
  sectionId: string;
  academicYearId: string;
}

export async function findActiveAcademicYearsForAssignment() {
  return prisma.academicYear.findMany({
    where: {
      status: "ACTIVE",
    },
    select: {
      id: true,
      label: true,
    },
    orderBy: [{ startDate: "desc" }, { id: "asc" }],
  });
}

export async function findAcademicYearForAssignment(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  if (transaction) {
    const academicYears = await transaction.$queryRaw<
      Array<{ id: string; label: string; status: AcademicYearStatus }>
    >(Prisma.sql`
      SELECT "id", "label", "status"
      FROM "AcademicYear"
      WHERE "id" = ${id}
      FOR SHARE
    `);

    return academicYears[0] ?? null;
  }

  return (transaction ?? prisma).academicYear.findUnique({
    where: { id },
    select: {
      id: true,
      label: true,
      status: true,
    },
  });
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
      academicYearId: true,
      academicYear: {
        select: {
          label: true,
          status: true,
        },
      },
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

export async function archiveSubjectAssignment(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subjectAssignment.update({
    where: {
      id,
    },
    data: {
      deletedAt: new Date(),
    },
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
      academicYearId: true,
      academicYear: {
        select: {
          label: true,
          status: true,
        },
      },
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
        academicYear: {
          startDate: "desc",
        },
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
      {
        id: "asc",
      },
    ],
  });
}
