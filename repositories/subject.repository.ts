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
