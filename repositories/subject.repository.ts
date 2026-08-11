import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export interface SubjectListFilters {
  search?: string;
  grade?: string;
  trackStrand?: string;
}

const subjectListSelect = {
  id: true,
  code: true,
  description: true,
  gradeLevel: true,
  trackStrand: true,
} satisfies Prisma.SubjectSelect;

export async function findSubjects() {
  return prisma.subject.findMany({
    where: {
      deletedAt: null,
    },
    select: subjectListSelect,
    orderBy: [
      { gradeLevel: "asc" },
      { code: "asc" },
      { trackStrand: "asc" },
    ],
  });
}

function getSubjectListWhere(
  filters: SubjectListFilters,
): Prisma.SubjectWhereInput {
  const searchTerms = filters.search?.split(/\s+/).filter(Boolean) ?? [];

  return {
    deletedAt: null,
    gradeLevel: filters.grade,
    trackStrand: filters.trackStrand,
    AND: searchTerms.map((term) => ({
      OR: [
        { code: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        { trackStrand: { contains: term, mode: "insensitive" } },
      ],
    })),
  };
}

export async function countNonArchivedSubjects(filters: SubjectListFilters) {
  return prisma.subject.count({
    where: getSubjectListWhere(filters),
  });
}

export async function findNonArchivedSubjects(
  filters: SubjectListFilters,
  pagination: { skip: number; take: number },
  orderBy: Prisma.SubjectOrderByWithRelationInput[],
) {
  return prisma.subject.findMany({
    where: getSubjectListWhere(filters),
    select: subjectListSelect,
    orderBy,
    skip: pagination.skip,
    take: pagination.take,
  });
}

function getSubjectGradeSortConditions(filters: SubjectListFilters) {
  const conditions: Prisma.Sql[] = [Prisma.sql`"deletedAt" IS NULL`];

  if (filters.grade) {
    conditions.push(Prisma.sql`"gradeLevel" = ${filters.grade}`);
  }

  if (filters.trackStrand) {
    conditions.push(Prisma.sql`"trackStrand" = ${filters.trackStrand}`);
  }

  for (const term of filters.search?.split(/\s+/).filter(Boolean) ?? []) {
    const pattern = `%${term}%`;
    conditions.push(Prisma.sql`(
      "code" ILIKE ${pattern}
      OR "description" ILIKE ${pattern}
      OR "trackStrand" ILIKE ${pattern}
    )`);
  }

  return conditions;
}

export async function findNonArchivedSubjectsByGrade(
  filters: SubjectListFilters,
  pagination: { skip: number; take: number },
  direction: "asc" | "desc",
) {
  const gradeDirection =
    direction === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const ids = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Subject"
    WHERE ${Prisma.join(getSubjectGradeSortConditions(filters), " AND ")}
    ORDER BY CASE
      WHEN BTRIM("gradeLevel") ~ '^[0-9]+$'
        THEN BTRIM("gradeLevel")::INTEGER
      ELSE NULL
    END ${gradeDirection} NULLS LAST,
    "code" ASC,
    "trackStrand" ASC NULLS LAST,
    "id" ASC
    OFFSET ${pagination.skip}
    LIMIT ${pagination.take}
  `);

  if (ids.length === 0) {
    return [];
  }

  const subjects = await prisma.subject.findMany({
    where: {
      deletedAt: null,
      id: {
        in: ids.map((subject) => subject.id),
      },
    },
    select: subjectListSelect,
  });
  const order = new Map(ids.map((subject, index) => [subject.id, index]));

  return subjects.sort(
    (first, second) =>
      (order.get(first.id) ?? 0) - (order.get(second.id) ?? 0),
  );
}

export async function findSubjectFilterOptionValues() {
  return Promise.all([
    prisma.subject.findMany({
      where: { deletedAt: null },
      distinct: ["gradeLevel"],
      select: { gradeLevel: true },
    }),
    prisma.subject.findMany({
      where: { deletedAt: null, trackStrand: { not: null } },
      distinct: ["trackStrand"],
      select: { trackStrand: true },
      orderBy: { trackStrand: "asc" },
    }),
  ]);
}

export async function findSubjectByIdentity(
  code: string,
  gradeLevel: string,
  trackStrand: string | null,
) {
  return prisma.subject.findFirst({
    where: {
      code,
      gradeLevel,
      trackStrand,
      deletedAt: null,
    },
  });
}

export async function createSubject(
  data: Prisma.SubjectUncheckedCreateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subject.create({
    data,
  });
}

export async function findActiveSubjectsByIdentities(
  identities: {
    code: string;
    gradeLevel: string;
    trackStrand: string | null;
  }[],
) {
  if (identities.length === 0) {
    return [];
  }

  return prisma.subject.findMany({
    where: {
      deletedAt: null,
      OR: identities,
    },
    select: {
      code: true,
      gradeLevel: true,
      trackStrand: true,
    },
  });
}

export async function findSubjectById(id: string) {
  return prisma.subject.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });
}

export async function updateSubject(
  id: string,
  data: Prisma.SubjectUpdateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subject.update({
    where: {
      id,
    },
    data,
  });
}

export async function findActiveSubjectById(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subject.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      description: true,
      gradeLevel: true,
      trackStrand: true,
    },
  });
}

export async function hasActiveSubjectAssignments(
  subjectId: string,
  transaction?: Prisma.TransactionClient,
) {
  const assignment = await (transaction ?? prisma).subjectAssignment.findFirst({
    where: {
      subjectId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  return assignment !== null;
}

export async function countSubjectGrades(
  subjectId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).grade.count({
    where: {
      subjectId,
    },
  });
}

export async function archiveSubject(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subject.update({
    where: {
      id,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}
