import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

const academicTermSelect = {
  id: true,
  academicYearId: true,
  name: true,
  position: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AcademicTermSelect;

export async function findAcademicTermsByAcademicYear(
  academicYearId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).academicTerm.findMany({
    where: { academicYearId },
    select: academicTermSelect,
    orderBy: [{ position: "asc" }, { id: "asc" }],
  });
}

export async function findAcademicTermById(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).academicTerm.findUnique({
    where: { id },
    select: academicTermSelect,
  });
}

export async function findOverlappingAcademicTerm(
  academicYearId: string,
  startDate: Date,
  endDate: Date,
  excludeId?: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).academicTerm.findFirst({
    where: {
      academicYearId,
      id: excludeId ? { not: excludeId } : undefined,
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true, name: true },
  });
}

export async function createAcademicTerm(
  data: Prisma.AcademicTermUncheckedCreateInput,
  transaction: Prisma.TransactionClient,
) {
  return transaction.academicTerm.create({ data, select: academicTermSelect });
}

export async function updateAcademicTerm(
  id: string,
  data: Prisma.AcademicTermUncheckedUpdateInput,
  transaction: Prisma.TransactionClient,
) {
  return transaction.academicTerm.update({
    where: { id },
    data,
    select: academicTermSelect,
  });
}

export async function deleteAcademicTerm(
  id: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.academicTerm.delete({
    where: { id },
    select: academicTermSelect,
  });
}
