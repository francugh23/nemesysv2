import prisma from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma/client";

export async function findSubjects() {
  return prisma.subject.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      description: true,
      gradeLevel: true,
      trackStrand: true,
      semester: true,
    },
    orderBy: [
      {
        gradeLevel: "asc",
      },
      {
        code: "asc",
      },
      {
        trackStrand: "asc",
      },
    ],
  });
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
