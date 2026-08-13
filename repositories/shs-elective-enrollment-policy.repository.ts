import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

const policySelect = {
  id: true,
  academicYearId: true,
  academicTermId: true,
  gradeLevel: true,
  minimumElectives: true,
  maximumElectives: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  academicYear: { select: { label: true, status: true } },
  academicTerm: {
    select: { name: true, position: true, startDate: true, endDate: true },
  },
} satisfies Prisma.ShsElectiveEnrollmentPolicySelect;

export function findShsElectiveEnrollmentPolicies(
  academicYearId?: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).shsElectiveEnrollmentPolicy.findMany({
    where: { academicYearId },
    select: policySelect,
    orderBy: [
      { academicYear: { startDate: "desc" } },
      { academicTerm: { position: "asc" } },
      { gradeLevel: "asc" },
    ],
  });
}

export function findShsElectiveEnrollmentPolicy(
  id: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.shsElectiveEnrollmentPolicy.findUnique({
    where: { id },
    select: policySelect,
  });
}

export async function lockShsElectiveEnrollmentPolicyScope(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "AcademicYear"
    WHERE "id" = ${academicYearId}
    FOR UPDATE
  `);
  return Boolean(rows[0]);
}

export async function lockShsElectiveEnrollmentPolicy(
  id: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "ShsElectiveEnrollmentPolicy"
    WHERE "id" = ${id}
    FOR UPDATE
  `);
  return Boolean(rows[0]);
}

export function findAcademicTermForShsElectiveEnrollmentPolicy(
  academicTermId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.academicTerm.findUnique({
    where: { id: academicTermId },
    select: { id: true, academicYearId: true, name: true, position: true },
  });
}

export function createShsElectiveEnrollmentPolicy(
  data: Prisma.ShsElectiveEnrollmentPolicyUncheckedCreateInput,
  transaction: Prisma.TransactionClient,
) {
  return transaction.shsElectiveEnrollmentPolicy.create({
    data,
    select: policySelect,
  });
}

export function updateShsElectiveEnrollmentPolicy(
  id: string,
  data: Pick<
    Prisma.ShsElectiveEnrollmentPolicyUncheckedUpdateInput,
    | "academicYearId"
    | "academicTermId"
    | "gradeLevel"
    | "minimumElectives"
    | "maximumElectives"
  >,
  transaction: Prisma.TransactionClient,
) {
  return transaction.shsElectiveEnrollmentPolicy.update({
    where: { id },
    data,
    select: policySelect,
  });
}
