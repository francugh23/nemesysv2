import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { isJhsGradeLevel } from "@/lib/subject-identity";
import { createAuditLogs } from "@/repositories/audit.repository";
import { lockAcademicYearsForCurriculumMutation } from "@/repositories/curriculum-finalization.repository";
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
  findOfferingFilterOptions,
  findOfferingOptions,
  findOfferings,
  findShsCurriculumCluster,
  findShsCurriculumClusterDuplicate,
  findShsCurriculumClusters,
  hasActiveOfferingForCluster,
  hasFinalizedOfferingForCluster,
  hasOfferingStudentDependencies,
  lockOfferingForMutation,
  promoteProvisionalShsOffering,
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
  PromoteShsSubjectOfferingInput,
} from "@/schemas";

export class SubjectOfferingServiceError extends Error {}

function assertActive(year: { status: string } | null) {
  if (!year || year.status !== "ACTIVE") {
    throw new SubjectOfferingServiceError("Subject offerings can only be changed while their academic year is active.");
  }
}

function assertCurriculumConfigurable(year: { curriculumFinalized: boolean }) {
  if (year.curriculumFinalized) {
    throw new SubjectOfferingServiceError("Curriculum is finalized and ordinary configuration changes are no longer allowed.");
  }
}

async function validate(
  values: CreateSubjectOfferingInput | UpdateSubjectOfferingInput,
  tx: Prisma.TransactionClient,
  exclude?: string,
  lockedYear?: { id: string; label: string; status: string; curriculumFinalized: boolean },
) {
  const [subject, terms, duplicate] = await Promise.all([
    findActiveSubjectById(values.subjectId, tx),
    findAcademicTermsByAcademicYear(values.academicYearId, tx),
    findOfferingDuplicate(values.subjectId, values.academicYearId, values.gradeLevel, exclude, tx),
  ]);
  const year = lockedYear ?? await lockAcademicYearForAcademicTerms(values.academicYearId, tx, "UPDATE");

  if (!subject) throw new SubjectOfferingServiceError("Subject not found or archived.");
  assertActive(year);
  if ("curriculumFinalized" in year) assertCurriculumConfigurable(year);
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
    if (!cluster.isSchoolFacing) throw new SubjectOfferingServiceError("Source-only SHS curriculum clusters cannot be used by Subject Offerings.");
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
  await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);
  const totalCount = await countOfferings(query);
  const page = Math.min(query.page, Math.max(1, Math.ceil(totalCount / query.pageSize)));
  return { items: await findOfferings(query, { skip: (page - 1) * query.pageSize, take: query.pageSize }), totalCount, page, pageSize: query.pageSize, pageCount: Math.ceil(totalCount / query.pageSize) };
}

export async function getSubjectOfferingOptions() {
  await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);
  const [[subjects, academicYears], shsClusters] = await Promise.all([
    findOfferingOptions(),
    findShsCurriculumClusters(),
  ]);
  return { subjects, academicYears, shsClusters };
}

export async function getSubjectOfferingFilterOptions() {
  await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);
  return { academicYears: await findOfferingFilterOptions() };
}

export async function createSubjectOfferingService(values: CreateSubjectOfferingInput) {
  const session = await requirePermission(Permissions.SUBJECTS);
  return prisma.$transaction((tx) =>
    createSubjectOfferingInTransaction(values, session.user.id, tx),
  );
}

export async function createSubjectOfferingInTransaction(
  values: CreateSubjectOfferingInput,
  actorId: string,
  tx: Prisma.TransactionClient,
) {
  const [lockedYear] = await lockAcademicYearsForCurriculumMutation([values.academicYearId], tx);
  if (!lockedYear) throw new SubjectOfferingServiceError("Academic Year not found.");
  assertCurriculumConfigurable(lockedYear);
  const { subject, year } = await validate(values, tx, undefined, lockedYear);
  const offering = await createOffering({ subjectId: subject.id, academicYearId: year.id, gradeLevel: values.gradeLevel, subjectCode: subject.code, subjectDescription: subject.description, createdById: actorId }, values.academicTermIds, values.shsContext, tx);
  await createAuditLogs([{ userId: actorId, action: "CREATE", module: "SubjectOffering", recordId: offering.id, recordName: `${offering.subjectCode} - ${year.label}`, description: "Created subject offering." }], tx);
  return offering;
}

export async function updateSubjectOfferingService(id: string, values: UpdateSubjectOfferingInput) {
  const session = await requirePermission(Permissions.SUBJECTS);
  return prisma.$transaction(async (tx) => {
    const reference = await findOffering(id, tx);
    if (!reference) throw new SubjectOfferingServiceError("Subject offering not found.");
    const lockedYears = await lockAcademicYearsForCurriculumMutation([reference.academicYearId, values.academicYearId], tx);
    if (lockedYears.length !== new Set([reference.academicYearId, values.academicYearId]).size) throw new SubjectOfferingServiceError("Academic Year not found.");
    lockedYears.forEach(assertCurriculumConfigurable);
    await lockOfferingForMutation(id, tx);
    const existing = await findOffering(id, tx);
    if (!existing) throw new SubjectOfferingServiceError("Subject offering not found.");
    if (await hasOfferingStudentDependencies(id, tx)) throw new SubjectOfferingServiceError("This Offering is locked by Student Participation and cannot be edited.");
    if (existing.shsContext?.curriculumStatus === "SCHOOL_APPROVED") throw new SubjectOfferingServiceError("School-approved SSHS offerings cannot be changed through the provisional offering workflow.");
    const targetYear = lockedYears.find(({ id: yearId }) => yearId === values.academicYearId)!;
    const { subject, year } = await validate(values, tx, id, targetYear);
    const offering = await updateOffering(id, { subjectId: subject.id, academicYearId: year.id, gradeLevel: values.gradeLevel, subjectCode: subject.code, subjectDescription: subject.description }, values.academicTermIds, values.shsContext, session.user.id, tx);
    await createAuditLogs([{ userId: session.user.id, action: "UPDATE", module: "SubjectOffering", recordId: id, recordName: `${offering.subjectCode} - ${year.label}`, description: "Updated subject offering." }], tx);
    return offering;
  });
}

export async function promoteShsSubjectOfferingService(values: PromoteShsSubjectOfferingInput) {
  const session = await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);
  return prisma.$transaction((tx) =>
    promoteShsSubjectOfferingInTransaction(values, session.user.id, tx),
  );
}

export async function promoteShsSubjectOfferingInTransaction(
  values: PromoteShsSubjectOfferingInput,
  actorId: string,
  tx: Prisma.TransactionClient,
) {
  const reference = await findOffering(values.subjectOfferingId, tx);
  if (!reference) throw new SubjectOfferingServiceError("SHS Offering pending school approval not found.");
  const [academicYear] = await lockAcademicYearsForCurriculumMutation([reference.academicYearId], tx);
  if (!academicYear) throw new SubjectOfferingServiceError("Academic Year not found.");
  assertCurriculumConfigurable(academicYear);
  await lockOfferingForMutation(values.subjectOfferingId, tx);
  const offering = await findOffering(values.subjectOfferingId, tx);
  if (!offering || offering.deletedAt || !offering.shsContext) throw new SubjectOfferingServiceError("SHS Offering pending school approval not found.");
  assertActive(offering.academicYear);
  if (offering.gradeLevel !== "11" && offering.gradeLevel !== "12") throw new SubjectOfferingServiceError("Only Grade 11 or 12 SSHS offerings can be approved.");
  if (offering.shsContext.curriculumStatus !== "PROVISIONAL_DEPED") throw new SubjectOfferingServiceError("Only SHS Offerings pending school approval can be approved.");
  if (await hasOfferingStudentDependencies(offering.id, tx)) throw new SubjectOfferingServiceError("An Offering used by Student Participation cannot have its approval changed.");
  const approvedAt = new Date();
  const promoted = await promoteProvisionalShsOffering(offering.id, values.approvalReference, actorId, approvedAt, tx);
  if (promoted.count !== 1) throw new SubjectOfferingServiceError("Offering approval could not be completed.");
  await createAuditLogs([{ userId: actorId, action: "UPDATE", module: "SubjectOffering", recordId: offering.id, recordName: `${offering.subjectCode} - ${offering.academicYear.label}`, description: "Approved SSHS subject offering for school use.", metadata: { previousCurriculumStatus: "PROVISIONAL_DEPED", curriculumStatus: "SCHOOL_APPROVED", approvalReference: values.approvalReference, approvedAt: approvedAt.toISOString() } }], tx);
  return offering.id;
}

export async function archiveSubjectOfferingService(id: string) {
  const session = await requirePermission(Permissions.SUBJECTS);
  return prisma.$transaction(async (tx) => {
    const reference = await findOffering(id, tx);
    if (!reference) throw new SubjectOfferingServiceError("Subject offering not found.");
    const [academicYear] = await lockAcademicYearsForCurriculumMutation([reference.academicYearId], tx);
    if (!academicYear) throw new SubjectOfferingServiceError("Academic Year not found.");
    assertCurriculumConfigurable(academicYear);
    await lockOfferingForMutation(id, tx);
    const offering = await findOffering(id, tx);
    if (!offering) throw new SubjectOfferingServiceError("Subject offering not found.");
    assertActive(offering.academicYear);
    await archiveOffering(id, tx);
    await createAuditLogs([{ userId: session.user.id, action: "ARCHIVE", module: "SubjectOffering", recordId: id, recordName: offering.subjectCode, description: "Archived subject offering." }], tx);
    return id;
  });
}

export async function getShsCurriculumClusters() {
  await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);
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
    if (cluster.sourceReference) throw new SubjectOfferingServiceError("Source-backed historical SHS curriculum clusters cannot be changed.");
    if (cluster.track !== values.track) throw new SubjectOfferingServiceError("An SHS curriculum cluster track cannot be changed after creation.");
    if ((cluster.code !== values.code || cluster.name !== values.name) && await hasFinalizedOfferingForCluster(id, tx)) {
      throw new SubjectOfferingServiceError("A cluster used by finalized Curriculum cannot be renamed.");
    }
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
    if (cluster.sourceReference) throw new SubjectOfferingServiceError("Source-backed historical SHS curriculum clusters cannot be archived.");
    if (await hasActiveOfferingForCluster(id, tx)) throw new SubjectOfferingServiceError("A cluster used by active Curriculum cannot be archived.");
    await archiveShsCurriculumCluster(id, tx);
    await createAuditLogs([{ userId: session.user.id, action: "ARCHIVE", module: "ShsCurriculumCluster", recordId: id, recordName: cluster.name, description: "Archived SHS curriculum cluster." }], tx);
    return id;
  });
}
