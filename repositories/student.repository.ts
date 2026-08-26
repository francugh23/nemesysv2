import prisma from "@/lib/prisma";

import { Prisma } from "@/app/generated/prisma/client";

export interface StudentListFilters {
  search?: string;
  status?: "UNENROLLED" | "ENROLLED" | "GRADUATED" | "TRANSFERRED" | "DROPPED";
  gender?: "MALE" | "FEMALE";
  grade?: string;
  sectionId?: string;
}

const studentListInclude = {
  currentSection: {
    select: {
      id: true,
      gradeLevel: true,
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
} satisfies Prisma.StudentInclude;

const studentExportSelect = {
  id: true,
  lrn: true,
  firstName: true,
  middleName: true,
  lastName: true,
  gender: true,
  status: true,
  createdAt: true,
  currentSection: {
    select: {
      gradeLevel: true,
      sectionName: true,
    },
  },
} satisfies Prisma.StudentSelect;

export type StudentExportProjection = Prisma.StudentGetPayload<{
  select: typeof studentExportSelect;
}>;

function getStudentListWhere(
  filters: StudentListFilters,
): Prisma.StudentWhereInput {
  const searchTerms = filters.search?.split(/\s+/).filter(Boolean) ?? [];

  return {
    deletedAt: null,
    status: filters.status,
    gender: filters.gender,
    currentSectionId: filters.sectionId,
    currentSection: filters.grade
      ? {
          gradeLevel: filters.grade,
        }
      : undefined,
    AND: searchTerms.map((term) => ({
      OR: [
        { lrn: { contains: term, mode: "insensitive" } },
        { firstName: { contains: term, mode: "insensitive" } },
        { middleName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
      ],
    })),
  };
}

export async function countNonArchivedStudents(
  filters: StudentListFilters,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).student.count({
    where: getStudentListWhere(filters),
  });
}

export async function findNonArchivedStudents(
  filters: StudentListFilters,
  pagination: { skip: number; take: number },
  orderBy: Prisma.StudentOrderByWithRelationInput[],
) {
  return prisma.student.findMany({
    where: getStudentListWhere(filters),
    include: studentListInclude,
    orderBy,
    skip: pagination.skip,
    take: pagination.take,
  });
}

function getStudentGradeSortConditions(filters: StudentListFilters) {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"student"."deletedAt" IS NULL`,
  ];

  if (filters.status) {
    conditions.push(
      Prisma.sql`"student"."status" = ${filters.status}::"StudentStatus"`,
    );
  }

  if (filters.gender) {
    conditions.push(
      Prisma.sql`"student"."gender" = ${filters.gender}::"Gender"`,
    );
  }

  if (filters.grade) {
    conditions.push(Prisma.sql`"section"."gradeLevel" = ${filters.grade}`);
  }

  if (filters.sectionId) {
    conditions.push(
      Prisma.sql`"student"."currentSectionId" = ${filters.sectionId}`,
    );
  }

  for (const term of filters.search?.split(/\s+/).filter(Boolean) ?? []) {
    const pattern = `%${term}%`;
    conditions.push(Prisma.sql`(
      "student"."lrn" ILIKE ${pattern}
      OR "student"."firstName" ILIKE ${pattern}
      OR "student"."middleName" ILIKE ${pattern}
      OR "student"."lastName" ILIKE ${pattern}
    )`);
  }

  return conditions;
}

async function findNonArchivedStudentIdsByGrade(
  filters: StudentListFilters,
  pagination: { skip: number; take: number },
  direction: "asc" | "desc",
  transaction?: Prisma.TransactionClient,
) {
  const gradeDirection =
    direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const ids = await (transaction ?? prisma).$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      SELECT "student"."id"
      FROM "Student" AS "student"
      LEFT JOIN "Section" AS "section"
        ON "section"."id" = "student"."currentSectionId"
      WHERE ${Prisma.join(getStudentGradeSortConditions(filters), " AND ")}
      ORDER BY CASE
        WHEN BTRIM("section"."gradeLevel") ~ '^[0-9]+$'
          THEN BTRIM("section"."gradeLevel")::INTEGER
        ELSE NULL
      END ${gradeDirection} NULLS LAST, "student"."id" ASC
      OFFSET ${pagination.skip}
      LIMIT ${pagination.take}
    `,
  );

  return ids.map((student) => student.id);
}

export async function findNonArchivedStudentsByGrade(
  filters: StudentListFilters,
  pagination: { skip: number; take: number },
  direction: "asc" | "desc",
) {
  const ids = await findNonArchivedStudentIdsByGrade(
    filters,
    pagination,
    direction,
  );

  if (ids.length === 0) return [];

  const students = await prisma.student.findMany({
    where: {
      id: {
        in: ids,
      },
    },
    include: studentListInclude,
  });
  const order = new Map(ids.map((id, index) => [id, index]));

  return students.sort(
    (first, second) =>
      (order.get(first.id) ?? 0) - (order.get(second.id) ?? 0),
  );
}

export async function findNonArchivedStudentsForExport(
  filters: StudentListFilters,
  pagination: { skip: number; take: number },
  orderBy: Prisma.StudentOrderByWithRelationInput[],
  transaction?: Prisma.TransactionClient,
): Promise<StudentExportProjection[]> {
  return (transaction ?? prisma).student.findMany({
    where: getStudentListWhere(filters),
    select: studentExportSelect,
    orderBy,
    skip: pagination.skip,
    take: pagination.take,
  });
}

export async function findNonArchivedStudentsForExportByGrade(
  filters: StudentListFilters,
  pagination: { skip: number; take: number },
  direction: "asc" | "desc",
  transaction?: Prisma.TransactionClient,
): Promise<StudentExportProjection[]> {
  const ids = await findNonArchivedStudentIdsByGrade(
    filters,
    pagination,
    direction,
    transaction,
  );

  if (ids.length === 0) return [];

  const students = await (transaction ?? prisma).student.findMany({
    where: { id: { in: ids } },
    select: studentExportSelect,
  });
  const order = new Map(ids.map((id, index) => [id, index]));

  return students.sort(
    (first, second) =>
      (order.get(first.id) ?? 0) - (order.get(second.id) ?? 0),
  );
}

export async function findStudentFilterOptionValues() {
  return Promise.all([
    prisma.student.findMany({
      where: { deletedAt: null },
      distinct: ["status"],
      select: { status: true },
      orderBy: { status: "asc" },
    }),
    prisma.student.findMany({
      where: { deletedAt: null },
      distinct: ["gender"],
      select: { gender: true },
      orderBy: { gender: "asc" },
    }),
    prisma.section.findMany({
      where: {
        currentStudents: {
          some: {
            deletedAt: null,
          },
        },
      },
      select: {
        id: true,
        gradeLevel: true,
        sectionName: true,
      },
    }),
  ]);
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
  return transaction.$queryRaw<Array<{
    id: string;
    status: string;
    currentSectionId: string | null;
    deletedAt: Date | null;
  }>>(Prisma.sql`
    SELECT "id", "status", "currentSectionId", "deletedAt"
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
