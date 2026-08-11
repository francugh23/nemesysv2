import { Prisma } from "@/app/generated/prisma/client";

export async function findCatalogActor(id: string, tx: Prisma.TransactionClient) {
  return tx.user.findFirst({ where: { id, deletedAt: null, status: "ACTIVE" }, select: { id: true } });
}

export async function findCatalogCluster(code: string, tx: Prisma.TransactionClient) {
  return tx.shsCurriculumCluster.findFirst({
    where: { code, deletedAt: null },
    select: { id: true, code: true, name: true, track: true, sourceReference: true, isSchoolFacing: true },
  });
}

export async function createCatalogCluster(data: Prisma.ShsCurriculumClusterUncheckedCreateInput, tx: Prisma.TransactionClient) {
  return tx.shsCurriculumCluster.create({ data, select: { id: true, code: true, name: true, track: true, sourceReference: true, isSchoolFacing: true } });
}

export async function updateCatalogClusterSchoolFacing(id: string, isSchoolFacing: boolean, tx: Prisma.TransactionClient) {
  return tx.shsCurriculumCluster.update({ where: { id }, data: { isSchoolFacing }, select: { id: true } });
}

export async function findOtherAcademicSchoolFacingClusters(catalogCodes: string[], tx: Prisma.TransactionClient) {
  return tx.shsCurriculumCluster.findMany({
    where: { track: "ACADEMIC", deletedAt: null, isSchoolFacing: true, code: { notIn: catalogCodes } },
    select: {
      id: true,
      code: true,
      name: true,
      sourceReference: true,
      _count: { select: { references: true, subjectOfferingContexts: true } },
    },
    orderBy: { code: "asc" },
  });
}

export async function findCatalogSubject(code: string, tx: Prisma.TransactionClient) {
  return tx.subject.findFirst({ where: { code, deletedAt: null }, select: { id: true, code: true, description: true, gradeLevel: true } });
}

export async function createCatalogSubject(data: Prisma.SubjectUncheckedCreateInput, tx: Prisma.TransactionClient) {
  return tx.subject.create({ data, select: { id: true, code: true, description: true, gradeLevel: true } });
}

export async function findCatalogReference(subjectId: string, tx: Prisma.TransactionClient) {
  return tx.shsCurriculumReference.findUnique({
    where: { subjectId },
    select: {
      id: true,
      gradeLevel: true,
      classification: true,
      curriculumStatus: true,
      clusterId: true,
      sourceReference: true,
      termApplicability: true,
      termPositions: true,
      schoolCategories: true,
    },
  });
}

export async function createCatalogReference(data: Prisma.ShsCurriculumReferenceUncheckedCreateInput, tx: Prisma.TransactionClient) {
  return tx.shsCurriculumReference.create({ data, select: { id: true } });
}

export async function updateCatalogReference(id: string, data: Prisma.ShsCurriculumReferenceUncheckedUpdateInput, tx: Prisma.TransactionClient) {
  return tx.shsCurriculumReference.update({ where: { id }, data, select: { id: true } });
}

export async function findAndLockCatalogOffering(subjectId: string, academicYearId: string, gradeLevel: string, tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "SubjectOffering"
    WHERE "subjectId" = ${subjectId}
      AND "academicYearId" = ${academicYearId}
      AND "gradeLevel" = ${gradeLevel}
      AND "deletedAt" IS NULL
    FOR UPDATE
  `);
  if (!rows[0]) return null;

  return tx.subjectOffering.findUnique({
    where: { id: rows[0].id },
    select: {
      id: true,
      subjectCode: true,
      subjectDescription: true,
      terms: { select: { academicTermId: true } },
      shsContext: { select: { classification: true, curriculumStatus: true, clusterId: true, sourceReference: true } },
      _count: { select: { studentSubjectEnrollments: true } },
    },
  });
}

export async function replaceCatalogOfferingTerms(subjectOfferingId: string, academicTermIds: string[], tx: Prisma.TransactionClient) {
  return tx.subjectOffering.update({
    where: { id: subjectOfferingId },
    data: {
      terms: {
        deleteMany: {},
        create: academicTermIds.map((academicTermId) => ({ academicTermId })),
      },
    },
    select: { id: true },
  });
}

export async function archiveCatalogOfferingWithoutTerms(subjectOfferingId: string, archivedAt: Date, tx: Prisma.TransactionClient) {
  await tx.subjectOfferingTerm.deleteMany({ where: { subjectOfferingId } });
  return tx.subjectOffering.update({ where: { id: subjectOfferingId }, data: { deletedAt: archivedAt }, select: { id: true } });
}
