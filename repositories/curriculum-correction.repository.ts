import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

import type { CorrectSubjectOfferingInput } from "@/schemas";

const correctionSourceSelect = {
  id: true,
  subjectId: true,
  academicYearId: true,
  gradeLevel: true,
  subjectCode: true,
  subjectDescription: true,
  createdById: true,
  deletedAt: true,
  replacesSubjectOfferingId: true,
  academicYear: {
    select: {
      id: true,
      label: true,
      status: true,
      curriculumFinalization: { select: { id: true, finalizedAt: true } },
      terms: {
        select: { id: true, name: true, position: true, startDate: true, endDate: true },
        orderBy: [{ position: "asc" as const }, { id: "asc" as const }],
      },
    },
  },
  terms: {
    select: {
      academicTermId: true,
      academicTerm: { select: { name: true, position: true, startDate: true, endDate: true } },
    },
    orderBy: { academicTerm: { position: "asc" as const } },
  },
  shsContext: {
    select: {
      classification: true,
      curriculumStatus: true,
      clusterId: true,
      sourceReference: true,
      approvalReference: true,
      approvedById: true,
      approvedAt: true,
      cluster: { select: { id: true, code: true, name: true, track: true } },
    },
  },
  sourceCurriculumCorrection: { select: { id: true, replacementOfferingId: true } },
  replacementCurriculumCorrection: { select: { id: true, sourceOfferingId: true } },
  _count: { select: { studentSubjectEnrollments: true } },
} satisfies Prisma.SubjectOfferingSelect;

export function findCorrectionSource(id: string, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).subjectOffering.findFirst({
    where: { id, deletedAt: null },
    select: correctionSourceSelect,
  });
}

export function findCurriculumCorrectionDetail(subjectOfferingId: string, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).curriculumCorrection.findFirst({
    where: {
      OR: [
        { sourceOfferingId: subjectOfferingId },
        { replacementOfferingId: subjectOfferingId },
      ],
    },
    select: {
      id: true,
      reason: true,
      evidenceReference: true,
      sourceWasFinalized: true,
      sourceParticipationCount: true,
      correctedAt: true,
      sourceConfigurationSnapshot: true,
      replacementConfigurationSnapshot: true,
      correctedBy: { select: { firstName: true, middleName: true, lastName: true } },
      effectiveAcademicTerm: { select: { id: true, name: true, position: true } },
      sourceOffering: { select: { id: true, subjectCode: true, subjectDescription: true, deletedAt: true } },
      replacementOffering: { select: { id: true, subjectCode: true, subjectDescription: true, deletedAt: true } },
    },
  });
}

export function findCorrectionFormOptions(transaction?: Prisma.TransactionClient) {
  const client = transaction ?? prisma;
  return Promise.all([
    client.subject.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, description: true, gradeLevel: true },
      orderBy: { code: "asc" },
    }),
    client.shsCurriculumCluster.findMany({
      where: { deletedAt: null, isSchoolFacing: true },
      select: { id: true, code: true, name: true, track: true },
      orderBy: [{ track: "asc" }, { name: "asc" }],
    }),
  ]);
}

export async function lockCorrectionIdentityConflicts(
  academicYearId: string,
  subjectId: string,
  gradeLevel: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "SubjectOffering"
    WHERE "academicYearId" = ${academicYearId}
      AND "subjectId" = ${subjectId}
      AND "gradeLevel" = ${gradeLevel}
      AND "deletedAt" IS NULL
    ORDER BY "id" FOR UPDATE
  `);
}

export async function lockCorrectionTermAndClusterScopes(
  academicTermIds: string[],
  clusterId: string | undefined,
  transaction: Prisma.TransactionClient,
) {
  if (academicTermIds.length) {
    await transaction.$queryRaw(Prisma.sql`
      SELECT "id" FROM "AcademicTerm"
      WHERE "id" IN (${Prisma.join([...academicTermIds].sort())})
      ORDER BY "id" FOR SHARE
    `);
  }
  if (clusterId) {
    await transaction.$queryRaw(Prisma.sql`
      SELECT "id" FROM "ShsCurriculumCluster" WHERE "id" = ${clusterId} FOR SHARE
    `);
  }
}

export async function lockCorrectionPolicyScopes(
  academicYearId: string,
  academicTermIds: string[],
  gradeLevel: string,
  transaction: Prisma.TransactionClient,
) {
  if (!academicTermIds.length) return [];
  return transaction.$queryRaw<Array<{ id: string; academicTermId: string }>>(Prisma.sql`
    SELECT "id", "academicTermId" FROM "ShsElectiveEnrollmentPolicy"
    WHERE "academicYearId" = ${academicYearId}
      AND "academicTermId" IN (${Prisma.join([...academicTermIds].sort())})
      AND "gradeLevel" = ${gradeLevel}
    ORDER BY "academicTermId", "id" FOR SHARE
  `);
}

export async function lockCorrectionParticipationImpact(
  sourceOfferingId: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "StudentSubjectEnrollment"
    WHERE "subjectOfferingId" = ${sourceOfferingId}
    ORDER BY "id" FOR SHARE
  `);
  const resultCount = await transaction.shsTermResult.count({
    where: { studentSubjectEnrollmentId: { in: rows.map(({ id }) => id) } },
  });
  return { participationCount: rows.length, resultCount };
}

export function setCurriculumCorrectionContext(id: string, transaction: Prisma.TransactionClient) {
  return transaction.$queryRaw<Array<{ set_config: string }>>`
    SELECT set_config('nemesys.curriculum_correction_id', ${id}, true)
  `;
}

export function createCurriculumCorrectionIntent(
  data: Prisma.CurriculumCorrectionUncheckedCreateInput,
  transaction: Prisma.TransactionClient,
) {
  return transaction.curriculumCorrection.create({ data, select: { id: true } });
}

export function archiveCorrectionSource(id: string, archivedAt: Date, transaction: Prisma.TransactionClient) {
  return transaction.subjectOffering.update({
    where: { id },
    data: { deletedAt: archivedAt },
    select: { id: true },
  });
}

export function createCorrectionReplacement(
  id: string,
  sourceOfferingId: string,
  academicYearId: string,
  subject: { id: string; code: string; description: string },
  values: CorrectSubjectOfferingInput["replacement"],
  actorId: string,
  correctedAt: Date,
  transaction: Prisma.TransactionClient,
) {
  const context = values.shsContext;
  return transaction.subjectOffering.create({
    data: {
      id,
      subjectId: subject.id,
      academicYearId,
      gradeLevel: values.gradeLevel,
      subjectCode: subject.code,
      subjectDescription: subject.description,
      createdById: actorId,
      replacesSubjectOfferingId: sourceOfferingId,
    },
    select: { id: true, subjectCode: true, subjectDescription: true },
  }).then(async (offering) => {
    for (const academicTermId of [...values.academicTermIds].sort()) {
      await transaction.subjectOfferingTerm.create({ data: { subjectOfferingId: id, academicTermId } });
    }
    if (context) {
      await transaction.subjectOfferingShsContext.create({
        data: {
          subjectOfferingId: id,
          classification: context.classification,
          curriculumStatus: "SCHOOL_APPROVED",
          clusterId: context.clusterId ?? null,
          sourceReference: context.sourceReference,
          approvalReference: context.approvalReference,
          approvedById: actorId,
          approvedAt: correctedAt,
          createdById: actorId,
        },
      });
    }
    return offering;
  });
}
