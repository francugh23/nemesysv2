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
  findOtherAcademicSchoolFacingClusters,
  findAndLockCatalogOffering,
  findCatalogReference,
  findCatalogSubject,
  replaceCatalogOfferingTerms,
  updateCatalogReference,
  updateCatalogClusterSchoolFacing,
} from "@/repositories/deped-reference-catalog.repository";
import { createOffering } from "@/repositories/subject-offering.repository";

export class DepedReferenceCatalogServiceError extends Error {}

function sameValues<T extends string | number>(left: T[], right: T[]) {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => value === sortedRight[index]);
}

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
  let updatedClusters = 0;
  let demotedCustomAcademicClusters = 0;
  let preservedOperationalClusters = 0;
  let createdSubjects = 0;
  let createdReferences = 0;
  let createdOfferings = 0;
  let updatedReferences = 0;
  let correctedTermReferences = 0;
  let mappedCategoryReferences = 0;
  let reconfiguredOfferings = 0;
  let archivedOfferings = 0;
  let removedOfferingTerms = 0;
  let unresolvedOperationalOfferings = 0;
  let skippedOperationalOfferings = 0;
  let conflicts = 0;
  const audits: Prisma.AuditLogCreateManyInput[] = [];
  const configuredTermIds = terms.map((term) => term.id).sort();
  const termIdByPosition = new Map(terms.map((term) => [term.position, term.id]));

  for (const cluster of depedShsCatalogClusters) {
    const existing = await findCatalogCluster(cluster.code, tx);
    if (existing) {
      const matchesCatalogIdentity = existing.name === cluster.name
        && existing.track === cluster.track
        && existing.sourceReference === cluster.sourceReference;
      if (!matchesCatalogIdentity) {
        conflicts += 1;
        continue;
      }
      clusterIds.set(cluster.code, existing.id);
      if (existing.isSchoolFacing !== cluster.isSchoolFacing) {
        await updateCatalogClusterSchoolFacing(existing.id, cluster.isSchoolFacing, tx);
        updatedClusters += 1;
        audits.push({
          userId: actor.id,
          action: "UPDATE",
          module: "ShsCurriculumCluster",
          recordId: existing.id,
          recordName: cluster.name,
          description: "Corrected whether the DepEd SSHS cluster is exposed as a school-facing category.",
          metadata: { changes: { isSchoolFacing: { from: existing.isSchoolFacing, to: cluster.isSchoolFacing } }, sourceReference: cluster.sourceReference },
        });
      }
      continue;
    }
    const created = await createCatalogCluster({ ...cluster, createdById: actor.id }, tx);
    clusterIds.set(cluster.code, created.id);
    createdClusters += 1;
    audits.push({ userId: actor.id, action: "CREATE", module: "ShsCurriculumCluster", recordId: created.id, recordName: cluster.name, description: "Created provisional DepEd SSHS curriculum cluster.", metadata: { curriculumStatus: "PROVISIONAL_DEPED", sourceReference: cluster.sourceReference } });
  }

  const catalogAcademicCodes = depedShsCatalogClusters.filter(({ track }) => track === "ACADEMIC").map(({ code }) => code);
  const otherAcademicClusters = await findOtherAcademicSchoolFacingClusters(catalogAcademicCodes, tx);
  for (const cluster of otherAcademicClusters) {
    await updateCatalogClusterSchoolFacing(cluster.id, false, tx);
    demotedCustomAcademicClusters += 1;
    if (cluster._count.subjectOfferingContexts > 0) preservedOperationalClusters += 1;
    audits.push({
      userId: actor.id,
      action: "UPDATE",
      module: "ShsCurriculumCluster",
      recordId: cluster.id,
      recordName: cluster.name,
      description: "Retained the Academic cluster as historical configuration while removing it from the fixed school-facing category list.",
      metadata: {
        changes: { isSchoolFacing: { from: true, to: false } },
        sourceReference: cluster.sourceReference ?? "SCHOOL_CONFIGURATION",
        referenceCount: cluster._count.references,
        offeringContextCount: cluster._count.subjectOfferingContexts,
      },
    });
  }

  for (const entry of depedShsCatalogEntries) {
    const existingSubject = await findCatalogSubject(entry.code, tx);
    const subject = existingSubject ?? await createCatalogSubject({ code: entry.code, description: entry.description, gradeLevel: entry.gradeLevel, createdById: actor.id }, tx);
    if (subject.gradeLevel !== entry.gradeLevel || subject.description !== entry.description) {
      conflicts += 1;
      continue;
    }
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
      termPositions: entry.termPositions,
      schoolCategories: entry.schoolCategories,
    };
    const existingReference = await findCatalogReference(subject.id, tx);
    if (!existingReference) {
      const reference = await createCatalogReference({ ...expectedReference, subjectId: subject.id, createdById: actor.id }, tx);
      createdReferences += 1;
      audits.push({ userId: actor.id, action: "CREATE", module: "ShsCurriculumReference", recordId: reference.id, recordName: entry.code, description: "Created provisional DepEd SSHS curriculum reference.", metadata: { classification: entry.classification, sourceReference: entry.sourceReference, termApplicability: entry.termApplicability, termPositions: entry.termPositions, schoolCategories: entry.schoolCategories } });
    } else {
      const referenceMatches = existingReference.gradeLevel === expectedReference.gradeLevel
        && existingReference.classification === expectedReference.classification
        && existingReference.curriculumStatus === expectedReference.curriculumStatus
        && existingReference.clusterId === expectedReference.clusterId
        && existingReference.sourceReference === expectedReference.sourceReference
        && existingReference.termApplicability === expectedReference.termApplicability
        && sameValues(existingReference.termPositions, expectedReference.termPositions)
        && sameValues(existingReference.schoolCategories, expectedReference.schoolCategories);
      if (referenceMatches) {
        // The reference is already reconciled; Offering checks still run below.
      } else {
        const isKnownLegacyReference = existingReference.gradeLevel === expectedReference.gradeLevel
          && existingReference.classification === expectedReference.classification
          && existingReference.curriculumStatus === expectedReference.curriculumStatus
          && existingReference.clusterId === expectedReference.clusterId
          && existingReference.sourceReference === expectedReference.sourceReference
          && existingReference.termApplicability === "UNSPECIFIED"
          && existingReference.termPositions.length === 0
          && existingReference.schoolCategories.length === 0
          && entry.classification === "ACADEMIC_ELECTIVE";
        if (!isKnownLegacyReference) {
          conflicts += 1;
          continue;
        }

        await updateCatalogReference(existingReference.id, expectedReference, tx);
        updatedReferences += 1;
        if (existingReference.termApplicability !== expectedReference.termApplicability || !sameValues(existingReference.termPositions, expectedReference.termPositions)) correctedTermReferences += 1;
        if (!sameValues(existingReference.schoolCategories, expectedReference.schoolCategories)) mappedCategoryReferences += 1;
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
        if (!sameValues(existingReference.termPositions, expectedReference.termPositions)) referenceChanges.termPositions = { from: existingReference.termPositions.join(", ") || "NONE", to: expectedReference.termPositions.join(", ") || "NONE" };
        if (!sameValues(existingReference.schoolCategories, expectedReference.schoolCategories)) referenceChanges.schoolCategories = { from: existingReference.schoolCategories.join(", ") || "NONE", to: expectedReference.schoolCategories.join(", ") || "NONE" };
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
    }

    const offeringClusterId = entry.offeringClusterCode ? clusterIds.get(entry.offeringClusterCode) : undefined;
    if (entry.offeringClusterCode && !offeringClusterId) {
      conflicts += 1;
      continue;
    }
    const expectedTermIds = entry.termApplicability === "ALL_CONFIGURED_TERMS"
      ? configuredTermIds
      : entry.termPositions.map((position) => termIdByPosition.get(position)).filter((id): id is string => Boolean(id)).sort();
    if (entry.termApplicability === "EXACT_CONFIGURED_TERMS" && entry.termPositions.length !== expectedTermIds.length) {
      throw new DepedReferenceCatalogServiceError(`Catalog entry ${entry.code} references an Academic Term position that is not configured.`);
    }

    const existingOffering = await findAndLockCatalogOffering(subject.id, academicYear.id, entry.gradeLevel, tx);
    const matchesCatalogSignature = existingOffering?.subjectCode === entry.code
      && existingOffering.subjectDescription === entry.description
      && existingOffering.shsContext?.classification === entry.classification
      && existingOffering.shsContext.clusterId === (offeringClusterId ?? clusterId ?? null)
      && existingOffering.shsContext.sourceReference === entry.sourceReference;
    if (!entry.createOffering) {
      if (!existingOffering) continue;
      const previousTermIds = existingOffering.terms.map(({ academicTermId }) => academicTermId).sort();
      const isLegacyUnresolvedCatalogOffering = (entry.termApplicability === "ONE_CONFIGURED_TERM_UNRESOLVED" || entry.termApplicability === "EXACT_CONFIGURED_TERMS")
        && matchesCatalogSignature
        && existingOffering.shsContext?.curriculumStatus === "PROVISIONAL_DEPED"
        && existingOffering._count.studentSubjectEnrollments === 0
        && previousTermIds.length === configuredTermIds.length
        && previousTermIds.every((id, index) => id === configuredTermIds[index]);
      if (!isLegacyUnresolvedCatalogOffering) {
        unresolvedOperationalOfferings += 1;
        if (existingOffering.shsContext?.curriculumStatus === "SCHOOL_APPROVED" || existingOffering._count.studentSubjectEnrollments > 0) skippedOperationalOfferings += 1;
        else conflicts += 1;
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

    if (entry.termApplicability !== "ALL_CONFIGURED_TERMS" && entry.termApplicability !== "EXACT_CONFIGURED_TERMS") {
      throw new DepedReferenceCatalogServiceError(`Catalog entry ${entry.code} cannot create an Offering without definitive Term applicability.`);
    }
    if (!existingOffering) {
      const offering = await createOffering({ subjectId: subject.id, academicYearId: academicYear.id, gradeLevel: entry.gradeLevel, subjectCode: entry.code, subjectDescription: entry.description, createdById: actor.id }, expectedTermIds, { classification: entry.classification, curriculumStatus: "PROVISIONAL_DEPED", clusterId: offeringClusterId, sourceReference: entry.sourceReference }, tx);
      createdOfferings += 1;
      audits.push({ userId: actor.id, action: "CREATE", module: "SubjectOffering", recordId: offering.id, recordName: `${entry.code} - ${academicYear.label}`, description: "Created provisional DepEd SSHS reference offering.", metadata: { classification: entry.classification, sourceReference: entry.sourceReference, termPositions: entry.termPositions, academicTermIds: expectedTermIds } });
      continue;
    }

    const existingTermIds = existingOffering.terms.map(({ academicTermId }) => academicTermId).sort();
    const termsMatch = sameValues(existingTermIds, expectedTermIds);
    if (termsMatch) continue;
    const matchesLegacyAcademicTerms = entry.classification !== "ACADEMIC_ELECTIVE" || sameValues(existingTermIds, configuredTermIds);
    if (!matchesCatalogSignature || !matchesLegacyAcademicTerms || existingOffering.shsContext?.curriculumStatus !== "PROVISIONAL_DEPED" || existingOffering._count.studentSubjectEnrollments > 0) {
      unresolvedOperationalOfferings += 1;
      if (existingOffering.shsContext?.curriculumStatus === "SCHOOL_APPROVED" || existingOffering._count.studentSubjectEnrollments > 0) skippedOperationalOfferings += 1;
      else conflicts += 1;
      continue;
    }

    await replaceCatalogOfferingTerms(existingOffering.id, expectedTermIds, tx);
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
          academicTermIds: { from: existingTermIds, to: expectedTermIds },
        },
        sourceReference: entry.sourceReference,
      },
    });
  }

  if (audits.length) await createAuditLogs(audits, tx);
  return {
    createdClusters,
    updatedClusters,
    demotedCustomAcademicClusters,
    preservedOperationalClusters,
    createdSubjects,
    createdReferences,
    createdOfferings,
    updatedReferences,
    correctedTermReferences,
    mappedCategoryReferences,
    reconfiguredOfferings,
    archivedOfferings,
    removedOfferingTerms,
    unresolvedOperationalOfferings,
    skippedOperationalOfferings,
    conflicts,
    unresolvedReferences: depedShsCatalogEntries.filter((entry) => entry.classification === "ACADEMIC_ELECTIVE" && !entry.createOffering).length,
  };
}
