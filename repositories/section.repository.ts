import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

export async function findActiveSections() {
  return prisma.section.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      gradeLevel: true,
      trackStrand: true,
      sectionName: true,
      adviserId: true,
      room: true,
      shift: true,
      adviser: {
        select: {
          user: {
            select: {
              firstName: true,
              middleName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        gradeLevel: "asc",
      },
      {
        trackStrand: "asc",
      },
      {
        sectionName: "asc",
      },
    ],
  });
}

export async function findActiveSectionByIdentity(
  gradeLevel: string,
  trackStrand: string | null,
  sectionName: string,
  excludeId?: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.findFirst({
    where: {
      gradeLevel,
      trackStrand,
      sectionName: {
        equals: sectionName,
        mode: "insensitive",
      },
      id: excludeId
        ? {
            not: excludeId,
          }
        : undefined,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });
}

export async function findActiveSectionById(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      gradeLevel: true,
      trackStrand: true,
      sectionName: true,
      adviserId: true,
      room: true,
      shift: true,
    },
  });
}

export async function createSection(
  data: Prisma.SectionUncheckedCreateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.create({
    data,
  });
}

export async function updateSection(
  id: string,
  data: Prisma.SectionUncheckedUpdateInput,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.update({
    where: {
      id,
    },
    data,
  });
}

export async function hasActiveSectionSubjectAssignments(
  sectionId: string,
  transaction?: Prisma.TransactionClient,
) {
  const assignment = await (transaction ?? prisma).subjectAssignment.findFirst({
    where: {
      sectionId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  return assignment !== null;
}

export async function hasActiveSectionEnrollments(
  sectionId: string,
  transaction?: Prisma.TransactionClient,
) {
  const enrollment = await (transaction ?? prisma).enrollment.findFirst({
    where: {
      sectionId,
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  return enrollment !== null;
}

export async function archiveSection(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.update({
    where: {
      id,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}

export async function findActiveSectionForAssignment(
  id: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).section.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      gradeLevel: true,
      trackStrand: true,
      sectionName: true,
    },
  });
}

export async function findActiveSectionsForAssignment() {
  return prisma.section.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      gradeLevel: true,
      trackStrand: true,
      sectionName: true,
    },
    orderBy: [
      {
        gradeLevel: "asc",
      },
      {
        trackStrand: "asc",
      },
      {
        sectionName: "asc",
      },
    ],
  });
}
