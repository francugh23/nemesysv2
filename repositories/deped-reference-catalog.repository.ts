import { Prisma } from "@/app/generated/prisma/client";

export async function findCatalogActor(id: string, tx: Prisma.TransactionClient) {
  return tx.user.findFirst({ where: { id, deletedAt: null, status: "ACTIVE" }, select: { id: true } });
}

export async function findCatalogCluster(code: string, tx: Prisma.TransactionClient) {
  return tx.shsCurriculumCluster.findFirst({ where: { code, deletedAt: null }, select: { id: true, track: true } });
}

export async function createCatalogCluster(data: Prisma.ShsCurriculumClusterUncheckedCreateInput, tx: Prisma.TransactionClient) {
  return tx.shsCurriculumCluster.create({ data, select: { id: true, track: true } });
}

export async function findCatalogSubject(code: string, tx: Prisma.TransactionClient) {
  return tx.subject.findFirst({ where: { code, deletedAt: null }, select: { id: true, gradeLevel: true } });
}

export async function createCatalogSubject(data: Prisma.SubjectUncheckedCreateInput, tx: Prisma.TransactionClient) {
  return tx.subject.create({ data, select: { id: true, gradeLevel: true } });
}

export async function findCatalogReference(subjectId: string, tx: Prisma.TransactionClient) {
  return tx.shsCurriculumReference.findUnique({ where: { subjectId }, select: { id: true } });
}

export async function createCatalogReference(data: Prisma.ShsCurriculumReferenceUncheckedCreateInput, tx: Prisma.TransactionClient) {
  return tx.shsCurriculumReference.create({ data, select: { id: true } });
}

export async function findCatalogOffering(subjectId: string, academicYearId: string, gradeLevel: string, tx: Prisma.TransactionClient) {
  return tx.subjectOffering.findFirst({ where: { subjectId, academicYearId, gradeLevel, deletedAt: null }, select: { id: true } });
}
