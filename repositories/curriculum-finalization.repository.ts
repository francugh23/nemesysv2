import { Prisma } from "@/app/generated/prisma/client";

export async function lockAcademicYearsForCurriculumMutation(
  academicYearIds: string[],
  transaction: Prisma.TransactionClient,
) {
  const orderedIds = [...new Set(academicYearIds)].sort();
  if (!orderedIds.length) return [];

  return transaction.$queryRaw<Array<{
    id: string;
    label: string;
    status: string;
    curriculumFinalized: boolean;
  }>>(Prisma.sql`
    SELECT academic_year."id", academic_year."label", academic_year."status",
      EXISTS (
        SELECT 1 FROM "CurriculumFinalization" finalization
        WHERE finalization."academicYearId" = academic_year."id"
      ) AS "curriculumFinalized"
    FROM "AcademicYear" academic_year
    WHERE academic_year."id" IN (${Prisma.join(orderedIds)})
    ORDER BY academic_year."id"
    FOR UPDATE
  `);
}

export function countPendingShsOfferings(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.subjectOffering.count({
    where: {
      academicYearId,
      deletedAt: null,
      gradeLevel: { in: ["11", "12"] },
      OR: [
        { shsContext: null },
        { shsContext: { is: { curriculumStatus: "PROVISIONAL_DEPED" } } },
      ],
    },
  });
}

export function createCurriculumFinalization(
  data: Prisma.CurriculumFinalizationUncheckedCreateInput,
  transaction: Prisma.TransactionClient,
) {
  return transaction.curriculumFinalization.create({
    data,
    select: {
      id: true,
      academicYearId: true,
      finalizedById: true,
      finalizedAt: true,
      createdAt: true,
    },
  });
}
