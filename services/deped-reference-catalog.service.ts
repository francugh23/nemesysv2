import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { depedShsCatalogClusters, depedShsCatalogEntries } from "@/lib/shs-deped-catalog";
import { createAuditLogs } from "@/repositories/audit.repository";
import { lockAcademicYearForAcademicTerms } from "@/repositories/academic-year.repository";
import { findAcademicTermsByAcademicYear } from "@/repositories/academic-term.repository";
import {
  createCatalogCluster,
  createCatalogReference,
  createCatalogSubject,
  findCatalogActor,
  findCatalogCluster,
  findCatalogOffering,
  findCatalogReference,
  findCatalogSubject,
} from "@/repositories/deped-reference-catalog.repository";
import { createOffering } from "@/repositories/subject-offering.repository";

export class DepedReferenceCatalogServiceError extends Error {}

export async function populateProvisionalDepedReferenceCatalog(actorId: string, academicYearId = "academic-year-2026-2027") {
  return prisma.$transaction(async (tx) => populateInTransaction(actorId, academicYearId, tx));
}

export async function populateInTransaction(actorId: string, academicYearId: string, tx: Prisma.TransactionClient) {
  const [actor, academicYear, terms] = await Promise.all([
    findCatalogActor(actorId, tx),
    lockAcademicYearForAcademicTerms(academicYearId, tx, "UPDATE"),
    findAcademicTermsByAcademicYear(academicYearId, tx),
  ]);
  if (!actor) throw new DepedReferenceCatalogServiceError("A current active user is required to populate the provisional DepEd catalog.");
  if (!academicYear || academicYear.status !== "ACTIVE") throw new DepedReferenceCatalogServiceError("The provisional DepEd catalog requires the configured active 2026-2027 Academic Year.");
  if (academicYear.label !== "2026-2027" || terms.length !== 3) throw new DepedReferenceCatalogServiceError("The provisional DepEd catalog requires the configured 2026-2027 three-term Academic Year.");

  const clusterIds = new Map<string, string>();
  let createdClusters = 0;
  let createdSubjects = 0;
  let createdReferences = 0;
  let createdOfferings = 0;
  const audits: Prisma.AuditLogCreateManyInput[] = [];

  for (const cluster of depedShsCatalogClusters) {
    const existing = await findCatalogCluster(cluster.code, tx);
    if (existing) {
      if (existing.track !== cluster.track) throw new DepedReferenceCatalogServiceError(`Existing cluster ${cluster.code} has an incompatible track.`);
      clusterIds.set(cluster.code, existing.id);
      continue;
    }
    const created = await createCatalogCluster({ ...cluster, createdById: actor.id }, tx);
    clusterIds.set(cluster.code, created.id);
    createdClusters += 1;
    audits.push({ userId: actor.id, action: "CREATE", module: "ShsCurriculumCluster", recordId: created.id, recordName: cluster.name, description: "Created provisional DepEd SSHS curriculum cluster.", metadata: { curriculumStatus: "PROVISIONAL_DEPED", sourceReference: cluster.sourceReference } });
  }

  for (const entry of depedShsCatalogEntries) {
    const existingSubject = await findCatalogSubject(entry.code, tx);
    const subject = existingSubject ?? await createCatalogSubject({ code: entry.code, description: entry.description, gradeLevel: entry.gradeLevel, createdById: actor.id }, tx);
    if (subject.gradeLevel !== entry.gradeLevel) throw new DepedReferenceCatalogServiceError(`Existing Subject ${entry.code} has an incompatible grade level.`);
    if (!existingSubject) {
      createdSubjects += 1;
      audits.push({ userId: actor.id, action: "CREATE", module: "Subject", recordId: subject.id, recordName: entry.code, description: "Created provisional DepEd SSHS reference Subject.", metadata: { curriculumStatus: "PROVISIONAL_DEPED", sourceReference: entry.sourceReference } });
    }

    const clusterId = entry.clusterCode ? clusterIds.get(entry.clusterCode) : undefined;
    if (entry.clusterCode && !clusterId) throw new DepedReferenceCatalogServiceError(`Catalog cluster ${entry.clusterCode} was not created.`);
    if (!await findCatalogReference(subject.id, tx)) {
      const reference = await createCatalogReference({ subjectId: subject.id, gradeLevel: entry.gradeLevel, classification: entry.classification, curriculumStatus: "PROVISIONAL_DEPED", clusterId: clusterId ?? null, sourceReference: entry.sourceReference, termApplicability: entry.termApplicability, createdById: actor.id }, tx);
      createdReferences += 1;
      audits.push({ userId: actor.id, action: "CREATE", module: "ShsCurriculumReference", recordId: reference.id, recordName: entry.code, description: "Created provisional DepEd SSHS curriculum reference.", metadata: { classification: entry.classification, sourceReference: entry.sourceReference, termApplicability: entry.termApplicability } });
    }

    if (!entry.createOffering || await findCatalogOffering(subject.id, academicYear.id, entry.gradeLevel, tx)) continue;
    const offering = await createOffering({ subjectId: subject.id, academicYearId: academicYear.id, gradeLevel: entry.gradeLevel, subjectCode: entry.code, subjectDescription: entry.description, createdById: actor.id }, terms.map((term) => term.id), { classification: entry.classification, curriculumStatus: "PROVISIONAL_DEPED", clusterId, sourceReference: entry.sourceReference }, tx);
    createdOfferings += 1;
    audits.push({ userId: actor.id, action: "CREATE", module: "SubjectOffering", recordId: offering.id, recordName: `${entry.code} - ${academicYear.label}`, description: "Created provisional DepEd SSHS reference offering.", metadata: { classification: entry.classification, sourceReference: entry.sourceReference } });
  }

  if (audits.length) await createAuditLogs(audits, tx);
  return { createdClusters, createdSubjects, createdReferences, createdOfferings };
}
