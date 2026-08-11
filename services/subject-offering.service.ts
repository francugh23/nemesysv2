import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { isJhsGradeLevel } from "@/lib/subject-identity";
import { createAuditLogs } from "@/repositories/audit.repository";
import { lockAcademicYearForAcademicTerms } from "@/repositories/academic-year.repository";
import { findAcademicTermsByAcademicYear } from "@/repositories/academic-term.repository";
import {
  archiveOffering,
  archiveShsCurriculumCluster,
  countOfferings,
  createOffering,
  createShsCurriculumCluster,
  findActiveShsCurriculumCluster,
  findOffering,
  findOfferingDuplicate,
  findOfferingOptions,
  findOfferings,
  findShsCurriculumCluster,
  findShsCurriculumClusterDuplicate,
  findShsCurriculumClusters,
  updateOffering,
  updateShsCurriculumCluster,
} from "@/repositories/subject-offering.repository";
import { findActiveSubjectById } from "@/repositories/subject.repository";
import type {
  CreateShsCurriculumClusterInput,
  CreateSubjectOfferingInput,
  SubjectOfferingTableQuery,
  UpdateShsCurriculumClusterInput,
  UpdateSubjectOfferingInput,
} from "@/schemas";

export class SubjectOfferingServiceError extends Error {}

function assertActive(year: { status: string } | null) {
  if (!year || year.status !== "ACTIVE") {
    throw new SubjectOfferingServiceError("Subject offerings can only be changed while their academic year is active.");
  }
}

async function validate(
  values: CreateSubjectOfferingInput | UpdateSubjectOfferingInput,
  tx: Prisma.TransactionClient,
  exclude?: string,
) {
  const [subject, year, terms, duplicate] = await Promise.all([
    findActiveSubjectById(values.subjectId, tx),
    lockAcademicYearForAcademicTerms(values.academicYearId, tx),
    findAcademicTermsByAcademicYear(values.academicYearId, tx),
    findOfferingDuplicate(values.subjectId, values.academicYearId, values.gradeLevel, exclude, tx),
  ]);

  if (!subject) throw new SubjectOfferingServiceError("Subject not found or archived.");
  assertActive(year);
  if (subject.gradeLevel !== values.gradeLevel) throw new SubjectOfferingServiceError("Offering grade level must match the Subject grade level.");
  if (duplicate) throw new SubjectOfferingServiceError("An active offering already exists for this subject, academic year, and grade level.");
  if (new Set(values.academicTermIds).size !== values.academicTermIds.length || values.academicTermIds.some((id) => !terms.some((term) => term.id === id))) {
    throw new SubjectOfferingServiceError("Selected terms must belong to the academic year.");
  }
  if (isJhsGradeLevel(values.gradeLevel) && (terms.length !== 3 || values.academicTermIds.length !== 3 || !terms.every((term) => values.academicTermIds.includes(term.id)))) {
    throw new SubjectOfferingServiceError("JHS offerings must apply to all three academic terms.");
  }

  if (values.shsContext?.clusterId) {
    const cluster = await findActiveShsCurriculumCluster(values.shsContext.clusterId, tx);
    if (!cluster) throw new SubjectOfferingServiceError("SHS curriculum cluster not found or archived.");
    if (values.shsContext.classification === "ACADEMIC_ELECTIVE" && cluster.track !== "ACADEMIC") throw new SubjectOfferingServiceError("Academic electives require an Academic curriculum cluster.");
    if (values.shsContext.classification === "TECHPRO_ELECTIVE" && cluster.track !== "TECHPRO") throw new SubjectOfferingServiceError("TechPro electives require a TechPro curriculum cluster.");
  }

  return { subject, year };
}

async function validateCluster(values: CreateShsCurriculumClusterInput | UpdateShsCurriculumClusterInput, tx: Prisma.TransactionClient, exclude?: string) {
  const duplicate = await findShsCurriculumClusterDuplicate(values.code, exclude, tx);
  if (duplicate) throw new SubjectOfferingServiceError("An active SHS curriculum cluster already uses this code.");
}

export async function getSubjectOfferings(query: SubjectOfferingTableQuery) {
  await requirePermission(Permissions.SUBJECTS);
  const totalCount = await countOfferings(query);
  const page = Math.min(query.page, Math.max(1, Math.ceil(totalCount / query.pageSize)));
  return { items: await findOfferings(query, { skip: (page - 1) * query.pageSize, take: query.pageSize }), totalCount, page, pageSize: query.pageSize, pageCount: Math.ceil(totalCount / query.pageSize) };
}

export async function getSubjectOfferingOptions() {
  await requirePermission(Permissions.SUBJECTS);
  const [[subjects, academicYears], shsClusters] = await Promise.all([
    findOfferingOptions(),
    findShsCurriculumClusters(),
  ]);
  return { subjects, academicYears, shsClusters };
}

export async function createSubjectOfferingService(values: CreateSubjectOfferingInput) {
  const session = await requirePermission(Permissions.SUBJECTS);
  return prisma.$transaction(async (tx) => {
    const { subject, year } = await validate(values, tx);
    const offering = await createOffering({ subjectId: subject.id, academicYearId: year.id, gradeLevel: values.gradeLevel, subjectCode: subject.code, subjectDescription: subject.description, createdById: session.user.id }, values.academicTermIds, values.shsContext, tx);
    await createAuditLogs([{ userId: session.user.id, action: "CREATE", module: "SubjectOffering", recordId: offering.id, recordName: `${offering.subjectCode} - ${year.label}`, description: "Created subject offering." }], tx);
    return offering;
  });
}

export async function updateSubjectOfferingService(id: string, values: UpdateSubjectOfferingInput) {
  const session = await requirePermission(Permissions.SUBJECTS);
  return prisma.$transaction(async (tx) => {
    const existing = await findOffering(id, tx);
    if (!existing) throw new SubjectOfferingServiceError("Subject offering not found.");
    const { subject, year } = await validate(values, tx, id);
    const offering = await updateOffering(id, { subjectId: subject.id, academicYearId: year.id, gradeLevel: values.gradeLevel, subjectCode: subject.code, subjectDescription: subject.description }, values.academicTermIds, values.shsContext, session.user.id, tx);
    await createAuditLogs([{ userId: session.user.id, action: "UPDATE", module: "SubjectOffering", recordId: id, recordName: `${offering.subjectCode} - ${year.label}`, description: "Updated subject offering." }], tx);
    return offering;
  });
}

export async function archiveSubjectOfferingService(id: string) {
  const session = await requirePermission(Permissions.SUBJECTS);
  return prisma.$transaction(async (tx) => {
    const offering = await findOffering(id, tx);
    if (!offering) throw new SubjectOfferingServiceError("Subject offering not found.");
    assertActive(offering.academicYear);
    await archiveOffering(id, tx);
    await createAuditLogs([{ userId: session.user.id, action: "ARCHIVE", module: "SubjectOffering", recordId: id, recordName: offering.subjectCode, description: "Archived subject offering." }], tx);
    return id;
  });
}

export async function getShsCurriculumClusters() {
  await requirePermission(Permissions.SUBJECTS);
  return findShsCurriculumClusters();
}

export async function createShsCurriculumClusterService(values: CreateShsCurriculumClusterInput) {
  const session = await requirePermission(Permissions.SUBJECTS);
  return prisma.$transaction(async (tx) => {
    await validateCluster(values, tx);
    const cluster = await createShsCurriculumCluster({ ...values, createdById: session.user.id }, tx);
    await createAuditLogs([{ userId: session.user.id, action: "CREATE", module: "ShsCurriculumCluster", recordId: cluster.id, recordName: cluster.name, description: "Created SHS curriculum cluster." }], tx);
    return cluster;
  });
}

export async function updateShsCurriculumClusterService(id: string, values: UpdateShsCurriculumClusterInput) {
  const session = await requirePermission(Permissions.SUBJECTS);
  return prisma.$transaction(async (tx) => {
    const cluster = await findShsCurriculumCluster(id, tx);
    if (!cluster) throw new SubjectOfferingServiceError("SHS curriculum cluster not found.");
    await validateCluster(values, tx, id);
    const updated = await updateShsCurriculumCluster(id, values, tx);
    await createAuditLogs([{ userId: session.user.id, action: "UPDATE", module: "ShsCurriculumCluster", recordId: id, recordName: updated.name, description: "Updated SHS curriculum cluster." }], tx);
    return updated;
  });
}

export async function archiveShsCurriculumClusterService(id: string) {
  const session = await requirePermission(Permissions.SUBJECTS);
  return prisma.$transaction(async (tx) => {
    const cluster = await findShsCurriculumCluster(id, tx);
    if (!cluster) throw new SubjectOfferingServiceError("SHS curriculum cluster not found.");
    await archiveShsCurriculumCluster(id, tx);
    await createAuditLogs([{ userId: session.user.id, action: "ARCHIVE", module: "ShsCurriculumCluster", recordId: id, recordName: cluster.name, description: "Archived SHS curriculum cluster." }], tx);
    return id;
  });
}
