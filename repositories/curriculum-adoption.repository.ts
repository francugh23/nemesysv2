import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

const yearSelect = {
  id: true,
  label: true,
  startDate: true,
  endDate: true,
  status: true,
  terms: {
    select: { id: true, name: true, position: true, startDate: true, endDate: true },
    orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.AcademicYearSelect;

const offeringSelect = {
  id: true,
  subjectId: true,
  academicYearId: true,
  gradeLevel: true,
  subjectCode: true,
  subjectDescription: true,
  deletedAt: true,
  subject: { select: { gradeLevel: true, deletedAt: true } },
  terms: {
    select: { academicTermId: true },
    orderBy: [{ academicTerm: { position: "asc" as const } }, { academicTermId: "asc" as const }],
  },
  shsContext: {
    select: {
      classification: true,
      curriculumStatus: true,
      sourceReference: true,
      clusterId: true,
      cluster: { select: { id: true, code: true, name: true, track: true, deletedAt: true } },
    },
  },
} satisfies Prisma.SubjectOfferingSelect;

export type CurriculumAdoptionYear = Prisma.AcademicYearGetPayload<{ select: typeof yearSelect }>;
export type CurriculumAdoptionOffering = Prisma.SubjectOfferingGetPayload<{ select: typeof offeringSelect }>;

export async function findCurriculumAdoptionYears(
  ids: string[],
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).academicYear.findMany({
    where: { id: { in: ids } },
    select: yearSelect,
  });
}

export async function findCurriculumAdoptionSourceYears(
  destinationAcademicYearId: string,
) {
  return prisma.academicYear.findMany({
    where: {
      id: { not: destinationAcademicYearId },
      status: { in: ["ACTIVE", "LOCKED", "ARCHIVED"] },
    },
    select: yearSelect,
    orderBy: [{ startDate: "desc" }, { id: "asc" }],
  });
}

export async function lockCurriculumAdoptionYears(
  ids: string[],
  transaction: Prisma.TransactionClient,
) {
  const sortedIds = [...ids].sort();
  return transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "AcademicYear"
    WHERE "id" IN (${Prisma.join(sortedIds)})
    ORDER BY "id"
    FOR UPDATE
  `);
}

export async function findSourceCurriculumAdoptionOfferings(
  academicYearId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subjectOffering.findMany({
    where: { academicYearId },
    select: offeringSelect,
    orderBy: [{ gradeLevel: "asc" }, { subjectCode: "asc" }, { id: "asc" }],
  });
}

export async function findDestinationCurriculumAdoptionOfferings(
  academicYearId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).subjectOffering.findMany({
    where: { academicYearId },
    select: {
      id: true,
      subjectId: true,
      gradeLevel: true,
      subjectCode: true,
      subjectDescription: true,
      deletedAt: true,
    },
    orderBy: { id: "asc" },
  });
}

export async function createAdoptedSubjectOffering(
  source: CurriculumAdoptionOffering,
  destinationAcademicYearId: string,
  destinationAcademicTermIds: string[],
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.subjectOffering.create({
    data: {
      subjectId: source.subjectId,
      academicYearId: destinationAcademicYearId,
      gradeLevel: source.gradeLevel,
      subjectCode: source.subjectCode,
      subjectDescription: source.subjectDescription,
      createdById: actorId,
      terms: {
        create: destinationAcademicTermIds.map((academicTermId) => ({ academicTermId })),
      },
      shsContext: source.shsContext
        ? {
            create: {
              classification: source.shsContext.classification,
              curriculumStatus: "PROVISIONAL_DEPED",
              clusterId: source.shsContext.clusterId,
              sourceReference: source.shsContext.sourceReference,
              approvalReference: null,
              approvedById: null,
              approvedAt: null,
              createdById: actorId,
            },
          }
        : undefined,
    },
    select: { id: true, subjectCode: true },
  });
}
