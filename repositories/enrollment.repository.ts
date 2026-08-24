import {
  Prisma,
  type AcademicYearStatus,
  type EnrollmentShsTrack,
  type EnrollmentStatus,
} from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

interface EnrollmentIdentity {
  studentId: string;
  academicYearId: string;
}

export interface EnrollmentListFilters {
  search?: string;
  status?: "ACTIVE" | "COMPLETED" | "DROPPED" | "TRANSFERRED";
  gradeLevel?: string;
  trackStrand?: string;
  academicYearId?: string;
  sectionId?: string;
}

function getEnrollmentListWhere(
  filters: EnrollmentListFilters,
): Prisma.EnrollmentWhereInput {
  const searchTerms = filters.search?.split(/\s+/).filter(Boolean) ?? [];

  return {
    deletedAt: null,
    status: filters.status,
    academicYearId: filters.academicYearId,
    sectionId: filters.sectionId,
    section: filters.gradeLevel || filters.trackStrand
      ? {
          gradeLevel: filters.gradeLevel,
          trackStrand: filters.trackStrand,
        }
      : undefined,
    AND: searchTerms.map((term) => ({
      OR: [
        { student: { lrn: { contains: term, mode: "insensitive" } } },
        {
          student: {
            firstName: { contains: term, mode: "insensitive" },
          },
        },
        {
          student: {
            middleName: { contains: term, mode: "insensitive" },
          },
        },
        {
          student: {
            lastName: { contains: term, mode: "insensitive" },
          },
        },
        {
          section: {
            sectionName: { contains: term, mode: "insensitive" },
          },
        },
        {
          academicYear: {
            label: { contains: term, mode: "insensitive" },
          },
        },
      ],
    })),
  };
}

export async function countNonArchivedEnrollments(
  filters: EnrollmentListFilters,
) {
  return prisma.enrollment.count({
    where: getEnrollmentListWhere(filters),
  });
}

export async function findNonArchivedEnrollments(
  filters: EnrollmentListFilters,
  pagination: { skip: number; take: number },
  orderBy: Prisma.EnrollmentOrderByWithRelationInput[],
) {
  return prisma.enrollment.findMany({
    where: getEnrollmentListWhere(filters),
    select: {
      id: true,
      studentId: true,
      sectionId: true,
      academicYearId: true,
      shsTrack: true,
      entryAcademicTermId: true,
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
      academicYear: {
        select: {
          label: true,
          status: true,
        },
      },
      entryAcademicTerm: {
        select: {
          name: true,
          position: true,
        },
      },
    },
    orderBy,
    skip: pagination.skip,
    take: pagination.take,
  });
}

function getEnrollmentGradeSortConditions(filters: EnrollmentListFilters) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"enrollment"."deletedAt" IS NULL`,
  ];

  if (filters.status) {
    conditions.push(
      Prisma.sql`"enrollment"."status" = ${filters.status}::"EnrollmentStatus"`,
    );
  }

  if (filters.academicYearId) {
    conditions.push(
      Prisma.sql`"enrollment"."academicYearId" = ${filters.academicYearId}`,
    );
  }

  if (filters.sectionId) {
    conditions.push(
      Prisma.sql`"enrollment"."sectionId" = ${filters.sectionId}`,
    );
  }

  if (filters.gradeLevel) {
    conditions.push(
      Prisma.sql`"section"."gradeLevel" = ${filters.gradeLevel}`,
    );
  }

  if (filters.trackStrand) {
    conditions.push(
      Prisma.sql`"section"."trackStrand" = ${filters.trackStrand}`,
    );
  }

  for (const term of filters.search?.split(/\s+/).filter(Boolean) ?? []) {
    const pattern = `%${term}%`;
    conditions.push(Prisma.sql`(
      "student"."lrn" ILIKE ${pattern}
      OR "student"."firstName" ILIKE ${pattern}
      OR "student"."middleName" ILIKE ${pattern}
      OR "student"."lastName" ILIKE ${pattern}
      OR "section"."sectionName" ILIKE ${pattern}
      OR "academicYear"."label" ILIKE ${pattern}
    )`);
  }

  return conditions;
}

export async function findNonArchivedEnrollmentsByGrade(
  filters: EnrollmentListFilters,
  pagination: { skip: number; take: number },
  direction: "asc" | "desc",
) {
  const gradeDirection =
    direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const enrollments = await prisma.$queryRaw<
    Array<{
      id: string;
      studentId: string;
      sectionId: string;
      academicYearId: string;
      academicYear: string;
      academicYearStatus: AcademicYearStatus;
      shsTrack: EnrollmentShsTrack | null;
      entryAcademicTermId: string | null;
      entryAcademicTermName: string | null;
      entryAcademicTermPosition: number | null;
      status: EnrollmentStatus;
      createdAt: Date;
      updatedAt: Date;
      studentLrn: string;
      studentFirstName: string;
      studentMiddleName: string | null;
      studentLastName: string;
      sectionGradeLevel: string;
      sectionTrackStrand: string | null;
      sectionName: string;
    }>
  >(Prisma.sql`
    SELECT
      "enrollment"."id",
      "enrollment"."studentId",
      "enrollment"."sectionId",
      "enrollment"."academicYearId",
      "enrollment"."shsTrack",
      "enrollment"."entryAcademicTermId",
      "entryAcademicTerm"."name" AS "entryAcademicTermName",
      "entryAcademicTerm"."position" AS "entryAcademicTermPosition",
      "academicYear"."label" AS "academicYear",
      "academicYear"."status" AS "academicYearStatus",
      "enrollment"."status",
      "enrollment"."createdAt",
      "enrollment"."updatedAt",
      "student"."lrn" AS "studentLrn",
      "student"."firstName" AS "studentFirstName",
      "student"."middleName" AS "studentMiddleName",
      "student"."lastName" AS "studentLastName",
      "section"."gradeLevel" AS "sectionGradeLevel",
      "section"."trackStrand" AS "sectionTrackStrand",
      "section"."sectionName" AS "sectionName"
    FROM "Enrollment" AS "enrollment"
    INNER JOIN "Student" AS "student"
      ON "student"."id" = "enrollment"."studentId"
    INNER JOIN "Section" AS "section"
      ON "section"."id" = "enrollment"."sectionId"
    INNER JOIN "AcademicYear" AS "academicYear"
      ON "academicYear"."id" = "enrollment"."academicYearId"
    LEFT JOIN "AcademicTerm" AS "entryAcademicTerm"
      ON "entryAcademicTerm"."id" = "enrollment"."entryAcademicTermId"
    WHERE ${Prisma.join(getEnrollmentGradeSortConditions(filters), " AND ")}
    ORDER BY CASE BTRIM("section"."gradeLevel")
      WHEN '7' THEN 7
      WHEN '8' THEN 8
      WHEN '9' THEN 9
      WHEN '10' THEN 10
      WHEN '11' THEN 11
      WHEN '12' THEN 12
      ELSE 999
    END ${gradeDirection}, "enrollment"."id" ASC
    OFFSET ${pagination.skip}
    LIMIT ${pagination.take}
  `);

  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    studentId: enrollment.studentId,
    sectionId: enrollment.sectionId,
    academicYearId: enrollment.academicYearId,
    shsTrack: enrollment.shsTrack,
    entryAcademicTermId: enrollment.entryAcademicTermId,
    status: enrollment.status,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
    student: {
      lrn: enrollment.studentLrn,
      firstName: enrollment.studentFirstName,
      middleName: enrollment.studentMiddleName,
      lastName: enrollment.studentLastName,
    },
    section: {
      gradeLevel: enrollment.sectionGradeLevel,
      trackStrand: enrollment.sectionTrackStrand,
      sectionName: enrollment.sectionName,
    },
    academicYear: {
      label: enrollment.academicYear,
      status: enrollment.academicYearStatus,
    },
    entryAcademicTerm: enrollment.entryAcademicTermId
      ? {
          name: enrollment.entryAcademicTermName!,
          position: enrollment.entryAcademicTermPosition!,
        }
      : null,
  }));
}

export async function findEnrollmentFilterOptionValues() {
  return Promise.all([
    prisma.academicYear.findMany({
      where: {
        enrollments: {
          some: {
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        label: true,
      },
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
    }),
    prisma.section.findMany({
      where: {
        enrollments: {
          some: {
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        gradeLevel: true,
        trackStrand: true,
        sectionName: true,
      },
      orderBy: [
        { gradeLevel: "asc" },
        { trackStrand: "asc" },
        { sectionName: "asc" },
      ],
    }),
  ]);
}

export async function findEnrollmentByIdentity(
  identity: EnrollmentIdentity,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).enrollment.findUnique({
    where: {
      studentId_academicYearId: identity,
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
      academicYearId: true,
      status: true,
      shsTrack: true,
      entryAcademicTermId: true,
      semester: true,
      createdById: true,
      createdAt: true,
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
      academicYear: {
        select: {
          label: true,
          status: true,
        },
      },
      entryAcademicTerm: {
        select: {
          name: true,
          position: true,
        },
      },
    },
  });
}

export async function findActiveAcademicYearsForEnrollment() {
  return prisma.academicYear.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      label: true,
      terms: {
        select: {
          id: true,
          name: true,
          position: true,
        },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ startDate: "desc" }, { id: "asc" }],
  });
}

export async function lockAcademicYearForEnrollment(
  id: string,
  transaction: Prisma.TransactionClient,
) {
  const academicYears = await transaction.$queryRaw<
    Array<{
      id: string;
      label: string;
      status: AcademicYearStatus;
    }>
  >(Prisma.sql`
    SELECT "id", "label", "status"
    FROM "AcademicYear"
    WHERE "id" = ${id}
    FOR SHARE
  `);

  return academicYears[0] ?? null;
}

export async function lockAcademicTermForEnrollment(
  id: string,
  transaction: Prisma.TransactionClient,
) {
  const terms = await transaction.$queryRaw<
    Array<{
      id: string;
      academicYearId: string;
      name: string;
      position: number;
    }>
  >(Prisma.sql`
    SELECT "id", "academicYearId", "name", "position"
    FROM "AcademicTerm"
    WHERE "id" = ${id}
    FOR SHARE
  `);

  return terms[0] ?? null;
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
      academicYear: { status: "ACTIVE" },
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
