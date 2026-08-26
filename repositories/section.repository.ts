import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

export interface SectionListFilters {
  search?: string;
  grade?: string;
  shift?: "MORNING" | "AFTERNOON";
  adviserId?: string;
}

const sectionListSelect = {
  id: true,
  gradeLevel: true,
  sectionName: true,
  adviserId: true,
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
} satisfies Prisma.SectionSelect;

function getSectionListWhere(
  filters: SectionListFilters,
): Prisma.SectionWhereInput {
  const searchTerms = filters.search?.split(/\s+/).filter(Boolean) ?? [];

  return {
    deletedAt: null,
    gradeLevel: filters.grade,
    shift: filters.shift,
    adviserId: filters.adviserId,
    AND: searchTerms.map((term) => ({
      OR: [
        { sectionName: { contains: term, mode: "insensitive" } },
        { room: { contains: term, mode: "insensitive" } },
        {
          adviser: {
            user: {
              OR: [
                { firstName: { contains: term, mode: "insensitive" } },
                { middleName: { contains: term, mode: "insensitive" } },
                { lastName: { contains: term, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    })),
  };
}

export async function countActiveSections(filters: SectionListFilters) {
  return prisma.section.count({
    where: getSectionListWhere(filters),
  });
}

export async function findActiveSections(
  filters: SectionListFilters,
  pagination: { skip: number; take: number },
  orderBy: Prisma.SectionOrderByWithRelationInput[],
) {
  return prisma.section.findMany({
    where: getSectionListWhere(filters),
    select: sectionListSelect,
    orderBy,
    skip: pagination.skip,
    take: pagination.take,
  });
}

function getSectionGradeSortConditions(filters: SectionListFilters) {
  const conditions: Prisma.Sql[] = [Prisma.sql`"section"."deletedAt" IS NULL`];

  if (filters.grade) {
    conditions.push(Prisma.sql`"section"."gradeLevel" = ${filters.grade}`);
  }

  if (filters.shift) {
    conditions.push(
      Prisma.sql`"section"."shift" = ${filters.shift}::"Shift"`,
    );
  }

  if (filters.adviserId) {
    conditions.push(Prisma.sql`"section"."adviserId" = ${filters.adviserId}`);
  }

  for (const term of filters.search?.split(/\s+/).filter(Boolean) ?? []) {
    const pattern = `%${term}%`;
    conditions.push(Prisma.sql`(
      "section"."sectionName" ILIKE ${pattern}
      OR "section"."room" ILIKE ${pattern}
      OR "user"."firstName" ILIKE ${pattern}
      OR "user"."middleName" ILIKE ${pattern}
      OR "user"."lastName" ILIKE ${pattern}
    )`);
  }

  return conditions;
}

export async function findActiveSectionsByGrade(
  filters: SectionListFilters,
  pagination: { skip: number; take: number },
  direction: "asc" | "desc",
  includeDefaultTieBreakers: boolean,
) {
  const gradeDirection =
    direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const tieBreakers = includeDefaultTieBreakers
    ? Prisma.sql`, "section"."sectionName" ASC, "section"."id" ASC`
    : Prisma.sql`, "section"."id" ASC`;
  const ids = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "section"."id"
    FROM "Section" AS "section"
    LEFT JOIN "Teacher" AS "teacher"
      ON "teacher"."id" = "section"."adviserId"
    LEFT JOIN "User" AS "user"
      ON "user"."id" = "teacher"."userId"
    WHERE ${Prisma.join(getSectionGradeSortConditions(filters), " AND ")}
    ORDER BY CASE
      WHEN BTRIM("section"."gradeLevel") ~ '^[0-9]+$'
        THEN BTRIM("section"."gradeLevel")::INTEGER
      ELSE NULL
    END ${gradeDirection} NULLS LAST${tieBreakers}
    OFFSET ${pagination.skip}
    LIMIT ${pagination.take}
  `);

  if (ids.length === 0) {
    return [];
  }

  const sections = await prisma.section.findMany({
    where: {
      id: { in: ids.map((section) => section.id) },
    },
    select: sectionListSelect,
  });
  const order = new Map(ids.map((section, index) => [section.id, index]));

  return sections.sort(
    (first, second) =>
      (order.get(first.id) ?? 0) - (order.get(second.id) ?? 0),
  );
}

export async function findSectionFilterOptionValues() {
  return Promise.all([
    prisma.section.findMany({
      where: { deletedAt: null },
      distinct: ["gradeLevel"],
      select: { gradeLevel: true },
    }),
    prisma.section.findMany({
      where: { deletedAt: null, shift: { not: null } },
      distinct: ["shift"],
      select: { shift: true },
      orderBy: { shift: "asc" },
    }),
    prisma.section.findMany({
      where: { deletedAt: null, adviserId: { not: null } },
      distinct: ["adviserId"],
      select: {
        adviserId: true,
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
    }),
  ]);
}

export async function findActiveSectionByIdentity(
  gradeLevel: string,
  sectionName: string,
  excludeId?: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.findFirst({
    where: {
      gradeLevel,
      sectionName: {
        equals: sectionName,
        mode: "insensitive",
      },
      id: excludeId
        ? {
            not: excludeId,
          }
        : undefined,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });
}

export async function findActiveSectionById(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      gradeLevel: true,
      sectionName: true,
      adviserId: true,
      room: true,
      shift: true,
    },
  });
}

export async function createSection(
  data: Prisma.SectionUncheckedCreateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.create({
    data,
  });
}

export async function updateSection(
  id: string,
  data: Prisma.SectionUncheckedUpdateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.update({
    where: {
      id,
    },
    data,
  });
}

export async function hasActiveSectionSubjectAssignments(
  sectionId: string,
  transaction?: Prisma.TransactionClient,
) {
  const assignment = await (transaction ?? prisma).subjectAssignment.findFirst({
    where: {
      sectionId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  return assignment !== null;
}

export async function hasActiveSectionEnrollments(
  sectionId: string,
  transaction?: Prisma.TransactionClient,
) {
  const enrollment = await (transaction ?? prisma).enrollment.findFirst({
    where: {
      sectionId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  return enrollment !== null;
}

export async function archiveSection(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.update({
    where: {
      id,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}

export async function findActiveSectionForAssignment(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      gradeLevel: true,
      sectionName: true,
    },
  });
}

export async function findActiveSectionsForAssignment() {
  return prisma.section.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      gradeLevel: true,
      sectionName: true,
    },
    orderBy: [
      {
        gradeLevel: "asc",
      },
      {
        sectionName: "asc",
      },
    ],
  });
}
