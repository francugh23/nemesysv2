import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

import type { CreateSubjectOfferingInput } from "@/schemas";

const clusterSelect = { id: true, code: true, name: true, track: true, isSchoolFacing: true } satisfies Prisma.ShsCurriculumClusterSelect;
const select = {
  id: true, subjectId: true, academicYearId: true, gradeLevel: true, subjectCode: true, subjectDescription: true, deletedAt: true,
  academicYear: { select: { label: true, status: true } },
  terms: { include: { academicTerm: true } },
  shsContext: { select: { classification: true, curriculumStatus: true, sourceReference: true, approvalReference: true, approvedById: true, approvedAt: true, cluster: { select: clusterSelect } } },
} satisfies Prisma.SubjectOfferingSelect;

type OfferingContext = CreateSubjectOfferingInput["shsContext"];
type OfferingListQuery = {
  q?: string;
  academicYearId?: string;
  gradeLevel?: string;
  curriculumStatus?: "PROVISIONAL_DEPED" | "SCHOOL_APPROVED";
};

function contextData(context: NonNullable<OfferingContext>, createdById: string) {
  return { ...context, clusterId: context.clusterId ?? null, sourceReference: context.sourceReference ?? null, approvalReference: context.approvalReference ?? null, createdById };
}

function getOfferingListWhere(q: OfferingListQuery): Prisma.SubjectOfferingWhereInput {
  const searchTerms = q.q?.split(/\s+/).filter(Boolean) ?? [];

  return {
    deletedAt: null,
    academicYearId: q.academicYearId,
    gradeLevel: q.gradeLevel,
    shsContext: q.curriculumStatus ? { curriculumStatus: q.curriculumStatus } : undefined,
    AND: searchTerms.map((term) => ({
      OR: [
        { subjectCode: { contains: term, mode: "insensitive" } },
        { subjectDescription: { contains: term, mode: "insensitive" } },
      ],
    })),
  };
}

export async function findOfferings(q: OfferingListQuery, p: { skip: number; take: number }) {
  return prisma.subjectOffering.findMany({ where: getOfferingListWhere(q), select, skip: p.skip, take: p.take, orderBy: [{ academicYear: { startDate: "desc" } }, { gradeLevel: "asc" }, { subjectCode: "asc" }] });
}
export async function countOfferings(q: OfferingListQuery, tx?: Prisma.TransactionClient) { return (tx ?? prisma).subjectOffering.count({ where: getOfferingListWhere(q) }); }
export async function findAcademicYearOfferingGradeCounts(academicYearId: string, tx?: Prisma.TransactionClient) {
  return (tx ?? prisma).subjectOffering.groupBy({
    by: ["gradeLevel"],
    where: { academicYearId, deletedAt: null },
    _count: { _all: true },
    orderBy: { gradeLevel: "asc" },
  });
}
export async function findOffering(id: string, tx?: Prisma.TransactionClient) { return (tx ?? prisma).subjectOffering.findFirst({ where: { id, deletedAt: null }, select }); }
export async function lockOfferingForMutation(id: string, tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "SubjectOffering" WHERE "id" = ${id} FOR UPDATE
  `);
  return Boolean(rows[0]);
}
export async function findOfferingDuplicate(subjectId: string, academicYearId: string, gradeLevel: string, excludeId?: string, tx?: Prisma.TransactionClient) { return (tx ?? prisma).subjectOffering.findFirst({ where: { subjectId, academicYearId, gradeLevel, deletedAt: null, id: excludeId ? { not: excludeId } : undefined }, select: { id: true } }); }
export async function createOffering(data: Prisma.SubjectOfferingUncheckedCreateInput, termIds: string[], context: OfferingContext, tx: Prisma.TransactionClient) {
  return tx.subjectOffering.create({ data: { ...data, terms: { create: termIds.map((academicTermId) => ({ academicTermId })) }, shsContext: context ? { create: contextData(context, data.createdById) } : undefined }, select });
}
export async function updateOffering(id: string, data: Prisma.SubjectOfferingUncheckedUpdateInput, termIds: string[], context: OfferingContext, contextCreatedById: string, tx: Prisma.TransactionClient) {
  if (!context) await tx.subjectOfferingShsContext.deleteMany({ where: { subjectOfferingId: id } });
  return tx.subjectOffering.update({ where: { id }, data: { ...data, terms: { deleteMany: {}, create: termIds.map((academicTermId) => ({ academicTermId })) }, shsContext: context ? { upsert: { create: contextData(context, contextCreatedById), update: { ...context, clusterId: context.clusterId ?? null, sourceReference: context.sourceReference ?? null, approvalReference: context.approvalReference ?? null } } } : undefined }, select });
}
export async function archiveOffering(id: string, tx: Prisma.TransactionClient) { return tx.subjectOffering.update({ where: { id }, data: { deletedAt: new Date() }, select }); }
export async function promoteProvisionalShsOffering(id: string, approvalReference: string, approvedById: string, approvedAt: Date, tx: Prisma.TransactionClient) {
  return tx.subjectOfferingShsContext.updateMany({ where: { subjectOfferingId: id, curriculumStatus: "PROVISIONAL_DEPED" }, data: { curriculumStatus: "SCHOOL_APPROVED", approvalReference, approvedById, approvedAt } });
}
export async function findOfferingOptions() {
  return Promise.all([
    prisma.subject.findMany({ where: { deletedAt: null }, select: { id: true, code: true, description: true, gradeLevel: true }, orderBy: { code: "asc" } }),
    prisma.academicYear.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, label: true, terms: { select: { id: true, name: true, position: true }, orderBy: { position: "asc" } } },
    }),
  ]);
}
export async function findOfferingFilterOptions() {
  return prisma.academicYear.findMany({
    where: { subjectOfferings: { some: { deletedAt: null } } },
    select: { id: true, label: true },
    orderBy: [{ startDate: "desc" }, { id: "asc" }],
  });
}
export async function findApprovedRegularJhsOfferings(academicYearId: string, gradeLevel: string, subjectCodes: string[], tx: Prisma.TransactionClient) { return tx.subjectOffering.findMany({ where: { academicYearId, gradeLevel, subjectCode: { in: subjectCodes }, deletedAt: null }, select: { id: true, gradeLevel: true, subjectCode: true, subjectDescription: true, terms: { select: { academicTermId: true }, orderBy: { academicTerm: { position: "asc" } } } }, orderBy: { subjectCode: "asc" } }); }

export async function findShsCurriculumClusters(includeArchived = false) { return prisma.shsCurriculumCluster.findMany({ where: includeArchived ? undefined : { deletedAt: null, isSchoolFacing: true }, select: clusterSelect, orderBy: [{ track: "asc" }, { name: "asc" }] }); }
const shsCurriculumReferenceSelect = {
  id: true,
  gradeLevel: true,
  classification: true,
  curriculumStatus: true,
  sourceReference: true,
  termApplicability: true,
  termPositions: true,
  schoolCategories: true,
  subject: { select: { code: true, description: true } },
  cluster: { select: clusterSelect },
} satisfies Prisma.ShsCurriculumReferenceSelect;

const shsCurriculumReferenceOrderBy = [
  { gradeLevel: "asc" },
  { classification: "asc" },
  { subject: { code: "asc" } },
] satisfies Prisma.ShsCurriculumReferenceOrderByWithRelationInput[];

export async function findShsCurriculumReferences(p?: { skip: number; take: number }) {
  return prisma.shsCurriculumReference.findMany({
    select: shsCurriculumReferenceSelect,
    orderBy: shsCurriculumReferenceOrderBy,
    skip: p?.skip,
    take: p?.take,
  });
}
export async function countShsCurriculumReferences() { return prisma.shsCurriculumReference.count(); }
export async function findActiveShsCurriculumCluster(id: string, tx: Prisma.TransactionClient) { return tx.shsCurriculumCluster.findFirst({ where: { id, deletedAt: null, isSchoolFacing: true }, select: clusterSelect }); }
export async function findShsCurriculumCluster(id: string, tx: Prisma.TransactionClient) { return tx.shsCurriculumCluster.findFirst({ where: { id, deletedAt: null, isSchoolFacing: true }, select: { ...clusterSelect, createdAt: true, sourceReference: true } }); }
export async function findShsCurriculumClusterDuplicate(code: string, excludeId: string | undefined, tx: Prisma.TransactionClient) { return tx.shsCurriculumCluster.findFirst({ where: { code: { equals: code, mode: "insensitive" }, deletedAt: null, id: excludeId ? { not: excludeId } : undefined }, select: { id: true } }); }
export async function createShsCurriculumCluster(data: Prisma.ShsCurriculumClusterUncheckedCreateInput, tx: Prisma.TransactionClient) { return tx.shsCurriculumCluster.create({ data, select: clusterSelect }); }
export async function updateShsCurriculumCluster(id: string, data: Prisma.ShsCurriculumClusterUncheckedUpdateInput, tx: Prisma.TransactionClient) { return tx.shsCurriculumCluster.update({ where: { id }, data, select: clusterSelect }); }
export async function archiveShsCurriculumCluster(id: string, tx: Prisma.TransactionClient) { return tx.shsCurriculumCluster.update({ where: { id }, data: { deletedAt: new Date() }, select: clusterSelect }); }
