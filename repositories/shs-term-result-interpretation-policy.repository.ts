import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

const policySelect = {
  id: true,
  academicYearId: true,
  passingThreshold: true,
  sourceReference: true,
  status: true,
  createdById: true,
  publishedById: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  academicYear: { select: { label: true, status: true } },
  createdBy: { select: { firstName: true, lastName: true } },
  publishedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ShsTermResultInterpretationPolicySelect;

export function findShsTermResultInterpretationPolicy(
  academicYearId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).shsTermResultInterpretationPolicy.findUnique({
    where: { academicYearId },
    select: policySelect,
  });
}

export function findPublishedShsTermResultInterpretationPolicyForEnrollment(
  enrollmentId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).shsTermResultInterpretationPolicy.findFirst({
    where: {
      status: "PUBLISHED",
      academicYear: {
        enrollments: { some: { id: enrollmentId, deletedAt: null } },
      },
    },
    select: {
      id: true,
      passingThreshold: true,
      status: true,
    },
  });
}

export async function lockAcademicYearForShsTermResultInterpretationPolicy(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string; label: string; status: string }>>(Prisma.sql`
    SELECT "id", "label", "status"
    FROM "AcademicYear"
    WHERE "id" = ${academicYearId}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export async function lockShsTermResultInterpretationPolicy(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "ShsTermResultInterpretationPolicy"
    WHERE "academicYearId" = ${academicYearId}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export function createShsTermResultInterpretationPolicyDraft(
  data: {
    academicYearId: string;
    passingThreshold: number;
    sourceReference: string;
    actorId: string;
  },
  transaction: Prisma.TransactionClient,
) {
  return transaction.shsTermResultInterpretationPolicy.create({
    data: {
      academicYearId: data.academicYearId,
      passingThreshold: data.passingThreshold,
      sourceReference: data.sourceReference,
      createdById: data.actorId,
    },
    select: policySelect,
  });
}

export function updateShsTermResultInterpretationPolicyDraft(
  id: string,
  data: { passingThreshold: number; sourceReference: string },
  transaction: Prisma.TransactionClient,
) {
  return transaction.shsTermResultInterpretationPolicy.updateMany({
    where: { id, status: "DRAFT" },
    data,
  });
}

export function publishShsTermResultInterpretationPolicy(
  id: string,
  actorId: string,
  publishedAt: Date,
  transaction: Prisma.TransactionClient,
) {
  return transaction.shsTermResultInterpretationPolicy.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: "PUBLISHED", publishedById: actorId, publishedAt },
  });
}
