import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { depedShsCatalogClusters, depedShsCatalogEntries } from "@/lib/shs-deped-catalog";
import { createAuditLogs } from "@/repositories/audit.repository";
import { lockAcademicYearForAcademicTerms } from "@/repositories/academic-year.repository";
import { findAcademicTermsByAcademicYear } from "@/repositories/academic-term.repository";
import {
  archiveCatalogOfferingWithoutTerms,
  createCatalogCluster,
  createCatalogReference,
  createCatalogSubject,
  findCatalogActor,
  findCatalogCluster,
  findAndLockCatalogOffering,
  findCatalogReference,
  findCatalogSubject,
  replaceCatalogOfferingTerms,
  updateCatalogReference,
} from "@/repositories/deped-reference-catalog.repository";
import { createOffering } from "@/repositories/subject-offering.repository";

export class DepedReferenceCatalogServiceError extends Error {}

export async function populateProvisionalDepedReferenceCatalog(actorId: string, academicYearId = "academic-year-2026-2027") {
  return prisma.$transaction(async (tx) => populateInTransaction(actorId, academicYearId, tx));
}

export async function populateInTransaction(actorId: string, academicYearId: string, tx: Prisma.TransactionClient) {
  const actor = await findCatalogActor(actorId, tx);
  const academicYear = await lockAcademicYearForAcademicTerms(academicYearId, tx, "UPDATE");
  const terms = await findAcademicTermsByAcademicYear(academicYearId, tx);
  if (!actor) throw new DepedReferenceCatalogServiceError("A current active user is required to populate the provisional DepEd catalog.");
  if (!academicYear || academicYear.status !== "ACTIVE") throw new DepedReferenceCatalogServiceError("The provisional DepEd catalog requires the configured active 2026-2027 Academic Year.");
  if (academicYear.label !== "2026-2027" || terms.length !== 3) throw new DepedReferenceCatalogServiceError("The provisional DepEd catalog requires the configured 2026-2027 three-term Academic Year.");

  const clusterIds = new Map<string, string>();
  let createdClusters = 0;
  let createdSubjects = 0;
  let createdReferences = 0;
  let createdOfferings = 0;
  let updatedReferences = 0;
  let reconfiguredOfferings = 0;
  let archivedOfferings = 0;
  let removedOfferingTerms = 0;
  let unresolvedOperationalOfferings = 0;
  const audits: Prisma.AuditLogCreateManyInput[] = [];
  const configuredTermIds = terms.map((term) => term.id).sort();

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
    const expectedReference = {
      gradeLevel: entry.gradeLevel,
      classification: entry.classification,
      curriculumStatus: "PROVISIONAL_DEPED" as const,
      clusterId: clusterId ?? null,
      sourceReference: entry.sourceReference,
      termApplicability: entry.termApplicability,
    };
    const existingReference = await findCatalogReference(subject.id, tx);
    if (!existingReference) {
      const reference = await createCatalogReference({ subjectId: subject.id, gradeLevel: entry.gradeLevel, classification: entry.classification, curriculumStatus: "PROVISIONAL_DEPED", clusterId: clusterId ?? null, sourceReference: entry.sourceReference, termApplicability: entry.termApplicability, createdById: actor.id }, tx);
      createdReferences += 1;
      audits.push({ userId: actor.id, action: "CREATE", module: "ShsCurriculumReference", recordId: reference.id, recordName: entry.code, description: "Created provisional DepEd SSHS curriculum reference.", metadata: { classification: entry.classification, sourceReference: entry.sourceReference, termApplicability: entry.termApplicability } });
    } else if (
      existingReference.gradeLevel !== expectedReference.gradeLevel
      || existingReference.classification !== expectedReference.classification
      || existingReference.curriculumStatus !== expectedReference.curriculumStatus
      || existingReference.clusterId !== expectedReference.clusterId
      || existingReference.sourceReference !== expectedReference.sourceReference
      || existingReference.termApplicability !== expectedReference.termApplicability
    ) {
      await updateCatalogReference(existingReference.id, expectedReference, tx);
      updatedReferences += 1;
      const referenceChanges: Record<string, { from: string; to: string }> = {};
      const addReferenceChange = (field: string, from: string | null, to: string | null) => {
        if (from !== to) referenceChanges[field] = { from: from ?? "NONE", to: to ?? "NONE" };
      };
      addReferenceChange("gradeLevel", existingReference.gradeLevel, expectedReference.gradeLevel);
      addReferenceChange("classification", existingReference.classification, expectedReference.classification);
      addReferenceChange("curriculumStatus", existingReference.curriculumStatus, expectedReference.curriculumStatus);
      addReferenceChange("clusterId", existingReference.clusterId, expectedReference.clusterId);
      addReferenceChange("sourceReference", existingReference.sourceReference, expectedReference.sourceReference);
      addReferenceChange("termApplicability", existingReference.termApplicability, expectedReference.termApplicability);
      audits.push({
        userId: actor.id,
        action: "UPDATE",
        module: "ShsCurriculumReference",
        recordId: existingReference.id,
        recordName: entry.code,
        description: "Corrected provisional DepEd SSHS curriculum reference configuration.",
        metadata: {
          changes: referenceChanges,
          sourceReference: entry.sourceReference,
        },
      });
    }

    const existingOffering = await findAndLockCatalogOffering(subject.id, academicYear.id, entry.gradeLevel, tx);
    const matchesCatalogSignature = existingOffering?.subjectCode === entry.code
      && existingOffering.subjectDescription === entry.description
      && existingOffering.shsContext?.classification === entry.classification
      && existingOffering.shsContext.clusterId === (clusterId ?? null)
      && existingOffering.shsContext.sourceReference === entry.sourceReference;
    if (!entry.createOffering) {
      if (!existingOffering) continue;
      const previousTermIds = existingOffering.terms.map(({ academicTermId }) => academicTermId).sort();
      const isLegacyUnresolvedCatalogOffering = entry.termApplicability === "ONE_CONFIGURED_TERM_UNRESOLVED"
        && matchesCatalogSignature
        && existingOffering.shsContext?.curriculumStatus === "PROVISIONAL_DEPED"
        && existingOffering._count.studentSubjectEnrollments === 0
        && previousTermIds.length === configuredTermIds.length
        && previousTermIds.every((id, index) => id === configuredTermIds[index]);
      if (!isLegacyUnresolvedCatalogOffering) {
        unresolvedOperationalOfferings += 1;
        continue;
      }

      await archiveCatalogOfferingWithoutTerms(existingOffering.id, new Date(), tx);
      archivedOfferings += 1;
      removedOfferingTerms += previousTermIds.length;
      audits.push({
        userId: actor.id,
        action: "ARCHIVE",
        module: "SubjectOffering",
        recordId: existingOffering.id,
        recordName: `${entry.code} - ${academicYear.label}`,
        description: "Archived provisional SSHS offering because DepEd does not establish its exact configured Term.",
        metadata: {
          changes: {
            academicTermIds: { from: previousTermIds, to: "UNRESOLVED" },
            lifecycle: { from: "ACTIVE", to: "ARCHIVED" },
          },
          sourceReference: entry.sourceReference,
          termApplicability: entry.termApplicability,
        },
      });
      continue;
    }

    if (entry.termApplicability !== "ALL_CONFIGURED_TERMS") {
      throw new DepedReferenceCatalogServiceError(`Catalog entry ${entry.code} cannot create an Offering without definitive Term applicability.`);
    }
    if (!existingOffering) {
      const offering = await createOffering({ subjectId: subject.id, academicYearId: academicYear.id, gradeLevel: entry.gradeLevel, subjectCode: entry.code, subjectDescription: entry.description, createdById: actor.id }, configuredTermIds, { classification: entry.classification, curriculumStatus: "PROVISIONAL_DEPED", clusterId, sourceReference: entry.sourceReference }, tx);
      createdOfferings += 1;
      audits.push({ userId: actor.id, action: "CREATE", module: "SubjectOffering", recordId: offering.id, recordName: `${entry.code} - ${academicYear.label}`, description: "Created provisional DepEd SSHS reference offering.", metadata: { classification: entry.classification, sourceReference: entry.sourceReference, academicTermIds: configuredTermIds } });
      continue;
    }

    const existingTermIds = existingOffering.terms.map(({ academicTermId }) => academicTermId).sort();
    const termsMatch = existingTermIds.length === configuredTermIds.length
      && existingTermIds.every((id, index) => id === configuredTermIds[index]);
    if (termsMatch) continue;
    if (!matchesCatalogSignature || existingOffering.shsContext?.curriculumStatus !== "PROVISIONAL_DEPED" || existingOffering._count.studentSubjectEnrollments > 0) {
      unresolvedOperationalOfferings += 1;
      continue;
    }

    await replaceCatalogOfferingTerms(existingOffering.id, configuredTermIds, tx);
    reconfiguredOfferings += 1;
    audits.push({
      userId: actor.id,
      action: "UPDATE",
      module: "SubjectOffering",
      recordId: existingOffering.id,
      recordName: `${entry.code} - ${academicYear.label}`,
      description: "Corrected provisional SSHS Offering Term applicability from official DepEd evidence.",
      metadata: {
        changes: {
          academicTermIds: { from: existingTermIds, to: configuredTermIds },
        },
        sourceReference: entry.sourceReference,
      },
    });
  }

  if (audits.length) await createAuditLogs(audits, tx);
  return {
    createdClusters,
    createdSubjects,
    createdReferences,
    createdOfferings,
    updatedReferences,
    reconfiguredOfferings,
    archivedOfferings,
    removedOfferingTerms,
    unresolvedOperationalOfferings,
  };
}
