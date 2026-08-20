import {
  Prisma,
  type AcademicYearStatus,
} from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

export interface AcademicYearListFilters {
  search?: string;
  status?: AcademicYearStatus;
}

const academicYearListSelect = {
  id: true,
  label: true,
  startDate: true,
  endDate: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  curriculumFinalization: {
    select: { finalizedAt: true },
  },
} satisfies Prisma.AcademicYearSelect;

const academicYearMutationSelect = {
  id: true,
  label: true,
  startDate: true,
  endDate: true,
  status: true,
} satisfies Prisma.AcademicYearSelect;

const academicYearConfigurationSelect = {
  ...academicYearListSelect,
  terms: {
    select: {
      id: true,
      academicYearId: true,
      name: true,
      position: true,
      startDate: true,
      endDate: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ position: "asc" }, { id: "asc" }],
  },
  curriculumFinalization: {
    select: {
      finalizedAt: true,
      finalizedBy: {
        select: { firstName: true, middleName: true, lastName: true },
      },
    },
  },
} satisfies Prisma.AcademicYearSelect;

function getAcademicYearListWhere(
  filters: AcademicYearListFilters,
): Prisma.AcademicYearWhereInput {
  const searchTerms = filters.search?.split(/\s+/).filter(Boolean) ?? [];

  return {
    status: filters.status,
    AND: searchTerms.map((term) => ({
      label: { contains: term, mode: "insensitive" },
    })),
  };
}

export async function countAcademicYears(filters: AcademicYearListFilters) {
  return prisma.academicYear.count({
    where: getAcademicYearListWhere(filters),
  });
}

export async function findAcademicYears(
  filters: AcademicYearListFilters,
  pagination: { skip: number; take: number },
  orderBy: Prisma.AcademicYearOrderByWithRelationInput[],
) {
  return prisma.academicYear.findMany({
    where: getAcademicYearListWhere(filters),
    select: academicYearListSelect,
    orderBy,
    skip: pagination.skip,
    take: pagination.take,
  });
}

export async function findAcademicYearStatusOptionValues() {
  return prisma.academicYear.findMany({
    distinct: ["status"],
    select: { status: true },
    orderBy: { status: "asc" },
  });
}

export async function findAcademicYearById(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).academicYear.findUnique({
    where: { id },
    select: academicYearMutationSelect,
  });
}

export async function findAcademicYearConfigurationById(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).academicYear.findUnique({
    where: { id },
    select: academicYearConfigurationSelect,
  });
}

export async function lockAcademicYearForAcademicTerms(
  id: string,
  transaction: Prisma.TransactionClient,
  lock: "SHARE" | "UPDATE" = "SHARE",
) {
  const academicYears = await transaction.$queryRaw<
    Array<{
      id: string;
      label: string;
      startDate: Date;
      endDate: Date;
      status: AcademicYearStatus;
    }>
  >(
    lock === "UPDATE"
      ? Prisma.sql`
          SELECT "id", "label", "startDate", "endDate", "status"
          FROM "AcademicYear"
          WHERE "id" = ${id}
          FOR UPDATE
        `
      : Prisma.sql`
          SELECT "id", "label", "startDate", "endDate", "status"
          FROM "AcademicYear"
          WHERE "id" = ${id}
          FOR SHARE
        `,
  );

  return academicYears[0] ?? null;
}

export async function findOverlappingAcademicYear(
  startDate: Date,
  endDate: Date,
  excludeId?: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).academicYear.findFirst({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: {
      id: true,
      label: true,
    },
  });
}

export async function createAcademicYear(
  data: Prisma.AcademicYearUncheckedCreateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).academicYear.create({
    data,
    select: academicYearMutationSelect,
  });
}

export async function updateDraftAcademicYear(
  id: string,
  data: Pick<Prisma.AcademicYearUncheckedUpdateInput, "label" | "startDate" | "endDate">,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).academicYear.updateMany({
    where: { id, status: "DRAFT" },
    data,
  });
}

export async function transitionAcademicYearStatus(
  id: string,
  fromStatus: AcademicYearStatus | AcademicYearStatus[],
  toStatus: AcademicYearStatus,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).academicYear.updateMany({
    where: {
      id,
      status: Array.isArray(fromStatus) ? { in: fromStatus } : fromStatus,
    },
    data: { status: toStatus },
  });
}
