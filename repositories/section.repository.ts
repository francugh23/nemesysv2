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
      deletedAt: null,
    },
    select: {
      id: true,
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
