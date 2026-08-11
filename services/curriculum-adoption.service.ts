import { randomUUID } from "node:crypto";

import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { isJhsGradeLevel } from "@/lib/subject-identity";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createAdoptedSubjectOffering,
  findCurriculumAdoptionYears,
  findCurriculumAdoptionSourceYears,
  findDestinationCurriculumAdoptionOfferings,
  findSourceCurriculumAdoptionOfferings,
  lockCurriculumAdoptionYears,
  type CurriculumAdoptionOffering,
  type CurriculumAdoptionYear,
} from "@/repositories/curriculum-adoption.repository";
import type {
  CommitCurriculumAdoptionInput,
  CurriculumAdoptionPreviewInput,
} from "@/schemas";

export class CurriculumAdoptionServiceError extends Error {}

type AdoptionReason = { code: string; message: string };

function assertYearsAndMappings(
  values: CurriculumAdoptionPreviewInput,
  years: CurriculumAdoptionYear[],
) {
  const sourceYear = years.find(({ id }) => id === values.sourceAcademicYearId);
  const destinationYear = years.find(({ id }) => id === values.destinationAcademicYearId);
  if (!sourceYear) throw new CurriculumAdoptionServiceError("Source Academic Year not found.");
  if (!destinationYear) throw new CurriculumAdoptionServiceError("Destination Academic Year not found.");
  if (!(["ACTIVE", "LOCKED", "ARCHIVED"] as const).includes(sourceYear.status as "ACTIVE" | "LOCKED" | "ARCHIVED")) {
    throw new CurriculumAdoptionServiceError("Source Academic Year must be active, locked, or archived.");
  }
  if (destinationYear.status !== "DRAFT") {
    throw new CurriculumAdoptionServiceError("Destination Academic Year must be in draft status.");
  }
  if (sourceYear.terms.length !== destinationYear.terms.length) {
    throw new CurriculumAdoptionServiceError("Source and destination Academic Years must have the same number of configured Terms.");
  }

  const sourceTermIds = new Set(sourceYear.terms.map(({ id }) => id));
  const destinationTermIds = new Set(destinationYear.terms.map(({ id }) => id));
  const mappedSourceIds = new Set(values.termMappings.map(({ sourceAcademicTermId }) => sourceAcademicTermId));
  const mappedDestinationIds = new Set(values.termMappings.map(({ destinationAcademicTermId }) => destinationAcademicTermId));
  if (
    values.termMappings.length !== sourceYear.terms.length ||
    mappedSourceIds.size !== sourceTermIds.size ||
    mappedDestinationIds.size !== destinationTermIds.size ||
    [...mappedSourceIds].some((id) => !sourceTermIds.has(id)) ||
    [...mappedDestinationIds].some((id) => !destinationTermIds.has(id))
  ) {
    throw new CurriculumAdoptionServiceError("Every configured source Term must map one-to-one to every configured destination Term.");
  }

  return { sourceYear, destinationYear };
}

function getInvalidReasons(offering: CurriculumAdoptionOffering): AdoptionReason[] {
  const reasons: AdoptionReason[] = [];
  if (offering.subject.deletedAt) {
    reasons.push({ code: "SUBJECT_ARCHIVED", message: "The related Subject is archived." });
  }
  if (offering.subject.gradeLevel !== offering.gradeLevel) {
    reasons.push({
      code: "SUBJECT_GRADE_MISMATCH",
      message: "The Offering grade does not match its reusable Subject definition.",
    });
  }

  if (isJhsGradeLevel(offering.gradeLevel)) {
    if (offering.shsContext) reasons.push({ code: "INVALID_SHS_CONTEXT", message: "A JHS Offering cannot have an SSHS context." });
    return reasons;
  }

  const context = offering.shsContext;
  if (!context) {
    reasons.push({ code: "MISSING_SHS_CONTEXT", message: "The SSHS Offering has no SSHS context." });
    return reasons;
  }
  if (!context.sourceReference?.trim()) {
    reasons.push({ code: "MISSING_SOURCE_REFERENCE", message: "The SSHS context has no valid source reference." });
  }
  if (context.classification === "CORE") {
    if (context.clusterId) reasons.push({ code: "INVALID_SHS_CLUSTER", message: "A Core SSHS Offering cannot have a curriculum cluster." });
    return reasons;
  }
  if (!context.cluster) {
    reasons.push({ code: "MISSING_SHS_CLUSTER", message: "The SSHS elective has no curriculum cluster." });
    return reasons;
  }
  if (context.cluster.deletedAt) {
    reasons.push({ code: "SHS_CLUSTER_ARCHIVED", message: "The related SSHS curriculum cluster is archived." });
  }
  const expectedTrack = context.classification === "ACADEMIC_ELECTIVE" ? "ACADEMIC" : "TECHPRO";
  if (context.cluster.track !== expectedTrack) {
    reasons.push({ code: "INVALID_SHS_CLUSTER_TRACK", message: `The SSHS curriculum cluster must use the ${expectedTrack} track.` });
  }
  return reasons;
}

async function buildPreview(values: CurriculumAdoptionPreviewInput, transaction?: Prisma.TransactionClient) {
  const years = await findCurriculumAdoptionYears(
    [values.sourceAcademicYearId, values.destinationAcademicYearId],
    transaction,
  );
  const { sourceYear, destinationYear } = assertYearsAndMappings(values, years);
  const sourceOfferings = await findSourceCurriculumAdoptionOfferings(
    sourceYear.id,
    transaction,
  );
  const destinationOfferings = await findDestinationCurriculumAdoptionOfferings(
    destinationYear.id,
    transaction,
  );
  const destinationTermById = new Map(destinationYear.terms.map((term) => [term.id, term]));
  const sourceTermById = new Map(sourceYear.terms.map((term) => [term.id, term]));
  const destinationTermIdBySourceId = new Map(values.termMappings.map((mapping) => [mapping.sourceAcademicTermId, mapping.destinationAcademicTermId]));

  const rows = { eligible: [] as ReturnType<typeof toRow>[], conflicts: [] as ReturnType<typeof toRow>[], ineligible: [] as ReturnType<typeof toRow>[], excluded: [] as ReturnType<typeof toRow>[] };
  for (const offering of sourceOfferings) {
    const matchingDestination = destinationOfferings.filter((destination) => destination.subjectId === offering.subjectId && destination.gradeLevel === offering.gradeLevel);
    const activeDestination = matchingDestination.find(({ deletedAt }) => !deletedAt);
    const archivedDestinationOfferingIds = matchingDestination.filter(({ deletedAt }) => deletedAt).map(({ id }) => id);
    const invalidReasons = getInvalidReasons(offering);
    const hasInvalidTerms = offering.terms.length === 0 || offering.terms.some(({ academicTermId }) => !sourceTermById.has(academicTermId));
    if (hasInvalidTerms) {
      invalidReasons.push({ code: "INVALID_TERM_APPLICABILITY", message: "The source Offering has missing or invalid Academic Term applicability." });
    }
    if (
      isJhsGradeLevel(offering.gradeLevel) &&
      (offering.terms.length !== sourceYear.terms.length ||
        sourceYear.terms.some((term) =>
          offering.terms.every(({ academicTermId }) => academicTermId !== term.id),
        ))
    ) {
      invalidReasons.push({
        code: "INCOMPLETE_JHS_TERM_APPLICABILITY",
        message: "A JHS Offering must apply to every configured source Term.",
      });
    }
    const mappedTerms = offering.terms.flatMap(({ academicTermId }) => {
      const source = sourceTermById.get(academicTermId);
      const destination = destinationTermById.get(destinationTermIdBySourceId.get(academicTermId) ?? "");
      return source && destination ? [{ source, destination }] : [];
    });

    if (offering.deletedAt) {
      rows.excluded.push(toRow(offering, [{ code: "SOURCE_OFFERING_ARCHIVED", message: "The source Subject Offering is archived." }, ...invalidReasons], mappedTerms, activeDestination, archivedDestinationOfferingIds));
    } else if (invalidReasons.length) {
      rows.ineligible.push(toRow(offering, invalidReasons, mappedTerms, activeDestination, archivedDestinationOfferingIds));
    } else if (activeDestination) {
      rows.conflicts.push(toRow(offering, [{ code: "ACTIVE_DESTINATION_IDENTITY", message: "An active destination Offering already uses this Subject and grade identity." }], mappedTerms, activeDestination, archivedDestinationOfferingIds));
    } else {
      const reasons = archivedDestinationOfferingIds.length
        ? [{ code: "ARCHIVED_DESTINATION_IDENTITY_ALLOWED", message: "Only archived destination identities exist; a new active Offering may be created." }]
        : [{ code: "ELIGIBLE", message: "The source Offering is eligible for adoption." }];
      rows.eligible.push(toRow(offering, reasons, mappedTerms, null, archivedDestinationOfferingIds));
    }
  }

  const expandedMappings = values.termMappings.map((mapping) => ({
    source: sourceTermById.get(mapping.sourceAcademicTermId)!,
    destination: destinationTermById.get(mapping.destinationAcademicTermId)!,
  }));
  return {
    sourceYear,
    destinationYear,
    termMappings: expandedMappings,
    rows,
    summary: Object.fromEntries(Object.entries(rows).map(([category, categoryRows]) => [category, categoryRows.length])) as Record<keyof typeof rows, number>,
  };
}

function toRow(
  offering: CurriculumAdoptionOffering,
  reasons: AdoptionReason[],
  mappedTerms: Array<{ source: CurriculumAdoptionYear["terms"][number]; destination: CurriculumAdoptionYear["terms"][number] }>,
  destinationConflict: { id: string; subjectCode: string; subjectDescription: string; deletedAt: Date | null } | null | undefined,
  archivedDestinationOfferingIds: string[],
) {
  return {
    sourceOfferingId: offering.id,
    subjectId: offering.subjectId,
    gradeLevel: offering.gradeLevel,
    subjectCode: offering.subjectCode,
    subjectDescription: offering.subjectDescription,
    sourceOfferingArchivedAt: offering.deletedAt,
    shsContext: offering.shsContext,
    mappedTerms,
    reasons,
    destinationConflict: destinationConflict ?? null,
    archivedDestinationOfferingIds,
  };
}

function rethrowAdoptionError(error: unknown): never {
  if (error instanceof CurriculumAdoptionServiceError) throw error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new CurriculumAdoptionServiceError("A destination Offering conflict was created concurrently. Refresh the preview and try again.");
    }
    if (error.code === "P2034") {
      throw new CurriculumAdoptionServiceError("Curriculum adoption conflicted with another change. Refresh the preview and try again.");
    }
  }
  throw error;
}

export async function previewCurriculumAdoptionService(values: CurriculumAdoptionPreviewInput) {
  await requirePermission(Permissions.SUBJECTS);
  return buildPreview(values);
}

export async function getCurriculumAdoptionOptionsService(
  destinationAcademicYearId: string,
) {
  await requirePermission(Permissions.SUBJECTS);
  const destinationYear = (
    await findCurriculumAdoptionYears([destinationAcademicYearId])
  )[0];
  if (!destinationYear) {
    throw new CurriculumAdoptionServiceError("Destination Academic Year not found.");
  }
  if (destinationYear.status !== "DRAFT") {
    throw new CurriculumAdoptionServiceError(
      "Destination Academic Year must be in draft status.",
    );
  }

  return {
    destinationYear,
    sourceYears: await findCurriculumAdoptionSourceYears(
      destinationAcademicYearId,
    ),
  };
}

export async function commitCurriculumAdoptionService(values: CommitCurriculumAdoptionInput) {
  const session = await requirePermission(Permissions.SUBJECTS);
  try {
    return await prisma.$transaction(async (transaction) => {
      const locked = await lockCurriculumAdoptionYears(
        [values.sourceAcademicYearId, values.destinationAcademicYearId],
        transaction,
      );
      if (locked.length !== 2) throw new CurriculumAdoptionServiceError("Source or destination Academic Year not found.");

      const preview = await buildPreview(values, transaction);
      const eligibleById = new Map(preview.rows.eligible.map((row) => [row.sourceOfferingId, row]));
      const allSourceIds = new Set(Object.values(preview.rows).flat().map((row) => row.sourceOfferingId));
      for (const sourceOfferingId of values.selectedSourceOfferingIds) {
        if (!allSourceIds.has(sourceOfferingId)) throw new CurriculumAdoptionServiceError("A selected source Offering does not belong to the source Academic Year.");
        if (!eligibleById.has(sourceOfferingId)) throw new CurriculumAdoptionServiceError("A selected source Offering is stale, invalid, archived, or conflicts with the destination. No Offerings were adopted.");
      }

      const sources = await findSourceCurriculumAdoptionOfferings(values.sourceAcademicYearId, transaction);
      const sourceById = new Map(sources.map((source) => [source.id, source]));
      const destinationTermIdBySourceId = new Map(values.termMappings.map((mapping) => [mapping.sourceAcademicTermId, mapping.destinationAcademicTermId]));
      const operationId = randomUUID();
      const adopted: Array<{ sourceOfferingId: string; destinationOfferingId: string }> = [];
      const perOfferingAudits: Prisma.AuditLogCreateManyInput[] = [];

      for (const sourceOfferingId of values.selectedSourceOfferingIds) {
        const source = sourceById.get(sourceOfferingId)!;
        const destinationTermIds = source.terms.map(({ academicTermId }) => destinationTermIdBySourceId.get(academicTermId)!);
        const destination = await createAdoptedSubjectOffering(source, values.destinationAcademicYearId, destinationTermIds, session.user.id, transaction);
        const offeringTermMappings = source.terms.map(({ academicTermId }) => ({
          sourceAcademicTermId: academicTermId,
          destinationAcademicTermId: destinationTermIdBySourceId.get(academicTermId)!,
        }));
        adopted.push({ sourceOfferingId, destinationOfferingId: destination.id });
        perOfferingAudits.push({
          userId: session.user.id,
          action: "ADOPT",
          module: "SubjectOffering",
          recordId: destination.id,
          recordName: `${destination.subjectCode} - ${preview.destinationYear.label}`,
          description: "Adopted a source Subject Offering into a draft Academic Year.",
          metadata: {
            operationId,
            sourceAcademicYear: { id: preview.sourceYear.id, label: preview.sourceYear.label, status: preview.sourceYear.status },
            destinationAcademicYear: { id: preview.destinationYear.id, label: preview.destinationYear.label, status: preview.destinationYear.status },
            sourceOfferingId,
            destinationOfferingId: destination.id,
            termMappings: offeringTermMappings,
            statuses: {
              sourceOffering: "ACTIVE",
              destinationOffering: "ACTIVE",
              sourceShsCurriculum: source.shsContext?.curriculumStatus ?? null,
              destinationShsCurriculum: source.shsContext ? "PROVISIONAL_DEPED" : null,
            },
          },
        });
      }

      await createAuditLogs([
        {
          userId: session.user.id,
          action: "ADOPT",
          module: "SubjectOfferingAdoption",
          recordId: operationId,
          recordName: `${preview.sourceYear.label} to ${preview.destinationYear.label}`,
          description: `Adopted ${adopted.length} Subject Offering${adopted.length === 1 ? "" : "s"} into a draft Academic Year.`,
          metadata: {
            operationId,
            sourceAcademicYear: { id: preview.sourceYear.id, label: preview.sourceYear.label, status: preview.sourceYear.status },
            destinationAcademicYear: { id: preview.destinationYear.id, label: preview.destinationYear.label, status: preview.destinationYear.status },
            termMappings: preview.termMappings.map(({ source, destination }) => ({ sourceAcademicTermId: source.id, destinationAcademicTermId: destination.id })),
            statuses: { sourceAcademicYear: preview.sourceYear.status, destinationAcademicYear: preview.destinationYear.status },
            offerings: adopted,
          },
        },
        ...perOfferingAudits,
      ], transaction);

      return { operationId, adopted };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    rethrowAdoptionError(error);
  }
}
