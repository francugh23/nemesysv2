import { randomUUID } from "node:crypto";

import { Prisma } from "@/app/generated/prisma/client";
import { getPhilippineCalendarDate } from "@/lib/academic-term-current";
import prisma from "@/lib/prisma";
import { isJhsGradeLevel } from "@/lib/subject-identity";
import { createAuditLogs } from "@/repositories/audit.repository";
import { lockAcademicYearsForCurriculumMutation } from "@/repositories/curriculum-finalization.repository";
import {
  archiveCorrectionSource,
  createCorrectionReplacement,
  createCurriculumCorrectionIntent,
  findCorrectionFormOptions,
  findCorrectionSource,
  findCurriculumCorrectionDetail,
  lockCorrectionIdentityConflicts,
  lockCorrectionParticipationImpact,
  lockCorrectionPolicyScopes,
  lockCorrectionTermAndClusterScopes,
  setCurriculumCorrectionContext,
} from "@/repositories/curriculum-correction.repository";
import { findActiveShsCurriculumCluster, lockOfferingForMutation } from "@/repositories/subject-offering.repository";
import { findActiveSubjectById } from "@/repositories/subject.repository";
import type { CorrectSubjectOfferingInput } from "@/schemas";

const MAX_TRANSACTION_ATTEMPTS = 3;

export class CurriculumCorrectionServiceError extends Error {}

async function authorizeCorrection() {
  const { Permissions, requirePermission } = await import("@/lib/authorization");
  return requirePermission(Permissions.SUBJECTS);
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getCalendarState(
  terms: Array<{ id: string; startDate: Date; endDate: Date; position: number }>,
  clock: () => Date,
) {
  const operationalDate = getPhilippineCalendarDate(clock());
  const activeTerms = terms.filter(
    ({ startDate, endDate }) => dateOnly(startDate) <= operationalDate && operationalDate <= dateOnly(endDate),
  );
  if (activeTerms.length > 1) {
    throw new CurriculumCorrectionServiceError("Overlapping Academic Terms prevent controlled Curriculum correction.");
  }
  return {
    operationalDate,
    activeTerm: activeTerms[0] ?? null,
    futureTerms: terms.filter(({ startDate }) => operationalDate < dateOnly(startDate)),
  };
}

function correctionEligibilityReason(
  source: NonNullable<Awaited<ReturnType<typeof findCorrectionSource>>>,
  operationalDate: string,
) {
  if (source.academicYear.status !== "ACTIVE") return "Controlled correction requires an active Academic Year.";
  if (source.sourceCurriculumCorrection) return "This Offering already has a controlled replacement.";
  if (!source.academicYear.curriculumFinalization && source._count.studentSubjectEnrollments === 0) {
    return "Unlocked Curriculum must continue using the ordinary edit or archive workflow.";
  }
  const activeTerm = source.academicYear.terms.find(
    ({ startDate, endDate }) => dateOnly(startDate) <= operationalDate && operationalDate <= dateOnly(endDate),
  );
  if (activeTerm) return `Controlled correction is unavailable during active ${activeTerm.name}.`;
  if (!source.academicYear.terms.some(({ startDate }) => operationalDate < dateOnly(startDate))) {
    return "Controlled correction is unavailable after all configured Academic Terms have started.";
  }
  if (isJhsGradeLevel(source.gradeLevel)) {
    const firstTerm = source.academicYear.terms[0];
    if (!firstTerm || operationalDate >= dateOnly(firstTerm.startDate)) {
      return "Same-year JHS correction is available only before Term 1 begins.";
    }
  }
  return null;
}

function snapshotOffering({
  subject,
  gradeLevel,
  terms,
  shsContext,
}: {
  subject: { id: string; code: string; description: string };
  gradeLevel: string;
  terms: Array<{ id: string; name: string; position: number }>;
  shsContext: {
    classification: string;
    curriculumStatus: string;
    clusterId?: string | null;
    cluster?: { code: string; name: string } | null;
    sourceReference?: string | null;
    approvalReference?: string | null;
    approvedById?: string | null;
    approvedAt?: Date | null;
  } | null;
}): Prisma.InputJsonObject {
  return {
    subjectId: subject.id,
    subjectCode: subject.code,
    subjectDescription: subject.description,
    gradeLevel,
    terms: terms.map((term) => ({ id: term.id, name: term.name, position: term.position })),
    shsContext: shsContext ? {
      classification: shsContext.classification,
      curriculumStatus: shsContext.curriculumStatus,
      clusterId: shsContext.clusterId ?? null,
      clusterCode: shsContext.cluster?.code ?? null,
      clusterName: shsContext.cluster?.name ?? null,
      sourceReference: shsContext.sourceReference ?? null,
      approvalReference: shsContext.approvalReference ?? null,
      approvedById: shsContext.approvedById ?? null,
      approvedAt: shsContext.approvedAt?.toISOString() ?? null,
    } : null,
  };
}

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; meta?: { code?: unknown }; cause?: unknown };
  return candidate.code === "40001" || candidate.code === "40P01" || candidate.meta?.code === "40001" || candidate.meta?.code === "40P01" || isRetryableTransactionError(candidate.cause);
}

async function runSerializableCorrection<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (isRetryableTransactionError(error) && attempt < MAX_TRANSACTION_ATTEMPTS) continue;
      if (isRetryableTransactionError(error)) {
        throw new CurriculumCorrectionServiceError("Curriculum changed concurrently. Refresh and try the correction again.");
      }
      if (error instanceof CurriculumCorrectionServiceError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new CurriculumCorrectionServiceError("This Offering already has a replacement or the successor identity is already active.");
      }
      throw new CurriculumCorrectionServiceError("Controlled Curriculum correction could not be completed.");
    }
  }
  throw new CurriculumCorrectionServiceError("Controlled Curriculum correction could not be completed.");
}

export async function getCurriculumCorrectionContext(sourceOfferingId: string, clock: () => Date = () => new Date()) {
  await authorizeCorrection();
  return prisma.$transaction(async (transaction) => {
    const source = await findCorrectionSource(sourceOfferingId, transaction);
    if (!source) throw new CurriculumCorrectionServiceError("Subject Offering not found or archived.");
    const [subjects, shsClusters] = await findCorrectionFormOptions(transaction);
    const impact = await lockCorrectionParticipationImpact(source.id, transaction);
    const operationalDate = getPhilippineCalendarDate(clock());
    return {
      source,
      subjects: subjects.filter(({ gradeLevel }) => gradeLevel === source.gradeLevel),
      shsClusters,
      impact,
      operationalDate,
      eligibilityReason: correctionEligibilityReason(source, operationalDate),
      effectiveTerms: source.academicYear.terms.filter(({ startDate }) => operationalDate < dateOnly(startDate)),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function getCurriculumCorrectionDetail(subjectOfferingId: string) {
  await authorizeCorrection();
  const correction = await findCurriculumCorrectionDetail(subjectOfferingId);
  if (!correction) throw new CurriculumCorrectionServiceError("Curriculum correction not found.");
  return correction;
}

export async function correctSubjectOfferingInTransaction(
  values: CorrectSubjectOfferingInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
  clock: () => Date = () => new Date(),
  ids: { correctionId: string; replacementOfferingId: string } = {
    correctionId: randomUUID(),
    replacementOfferingId: randomUUID(),
  },
) {
  const reference = await findCorrectionSource(values.sourceOfferingId, transaction);
  if (!reference) throw new CurriculumCorrectionServiceError("Subject Offering not found or archived.");

  const [lockedYear] = await lockAcademicYearsForCurriculumMutation([reference.academicYearId], transaction);
  if (!lockedYear) throw new CurriculumCorrectionServiceError("Academic Year not found.");
  if (lockedYear.status !== "ACTIVE") throw new CurriculumCorrectionServiceError("Controlled correction requires an active Academic Year.");

  await lockOfferingForMutation(reference.id, transaction);
  const source = await findCorrectionSource(reference.id, transaction);
  if (!source) throw new CurriculumCorrectionServiceError("Subject Offering changed. Refresh and try again.");
  if (values.confirmation !== source.subjectCode) throw new CurriculumCorrectionServiceError("Confirmation must exactly match the source Subject code.");
  if (values.replacement.gradeLevel !== source.gradeLevel) throw new CurriculumCorrectionServiceError("A correction replacement must retain the source grade level.");

  const subject = await findActiveSubjectById(values.replacement.subjectId, transaction);
  if (!subject) throw new CurriculumCorrectionServiceError("Replacement Subject not found or archived.");
  if (subject.gradeLevel !== source.gradeLevel) throw new CurriculumCorrectionServiceError("Replacement Subject grade must match the source Offering grade.");

  const conflicts = await lockCorrectionIdentityConflicts(source.academicYearId, subject.id, source.gradeLevel, transaction);
  if (conflicts.some(({ id }) => id !== source.id)) {
    throw new CurriculumCorrectionServiceError("An active Offering already uses the replacement Subject identity in this Academic Year and grade.");
  }

  const uniqueTermIds = [...new Set(values.replacement.academicTermIds)];
  if (uniqueTermIds.length !== values.replacement.academicTermIds.length) {
    throw new CurriculumCorrectionServiceError("Replacement Academic Terms must be unique.");
  }
  await lockCorrectionTermAndClusterScopes(uniqueTermIds, values.replacement.shsContext?.clusterId, transaction);
  const policies = values.replacement.shsContext?.classification === "ACADEMIC_ELECTIVE" || values.replacement.shsContext?.classification === "TECHPRO_ELECTIVE"
    ? await lockCorrectionPolicyScopes(source.academicYearId, uniqueTermIds, source.gradeLevel, transaction)
    : [];
  const impact = await lockCorrectionParticipationImpact(source.id, transaction);

  const calendar = getCalendarState(source.academicYear.terms, clock);
  const eligibilityReason = correctionEligibilityReason(source, calendar.operationalDate);
  if (eligibilityReason) throw new CurriculumCorrectionServiceError(eligibilityReason);
  const effectiveTerm = source.academicYear.terms.find(({ id }) => id === values.effectiveAcademicTermId);
  if (!effectiveTerm) throw new CurriculumCorrectionServiceError("Effective Academic Term must belong to the source Academic Year.");
  if (calendar.operationalDate >= dateOnly(effectiveTerm.startDate)) {
    throw new CurriculumCorrectionServiceError("Effective Academic Term must be future and unstarted.");
  }
  const replacementTerms = source.academicYear.terms.filter(({ id }) => uniqueTermIds.includes(id));
  if (replacementTerms.length !== uniqueTermIds.length) {
    throw new CurriculumCorrectionServiceError("Replacement Academic Terms must belong to the source Academic Year.");
  }
  if (!uniqueTermIds.includes(effectiveTerm.id)) {
    throw new CurriculumCorrectionServiceError("Replacement Terms must include the effective Academic Term.");
  }

  if (isJhsGradeLevel(source.gradeLevel)) {
    const firstTerm = source.academicYear.terms[0];
    if (!firstTerm || effectiveTerm.id !== firstTerm.id || replacementTerms.length !== source.academicYear.terms.length) {
      throw new CurriculumCorrectionServiceError("JHS correction must be effective before Term 1 and retain every configured Academic Term.");
    }
  } else if (replacementTerms.some(({ startDate }) => dateOnly(startDate) < dateOnly(effectiveTerm.startDate))) {
    throw new CurriculumCorrectionServiceError("SHS replacement Terms cannot precede the effective Academic Term.");
  }

  let cluster: Awaited<ReturnType<typeof findActiveShsCurriculumCluster>> = null;
  const context = values.replacement.shsContext;
  if (context?.clusterId) {
    cluster = await findActiveShsCurriculumCluster(context.clusterId, transaction);
    if (!cluster || !cluster.isSchoolFacing) throw new CurriculumCorrectionServiceError("Replacement SHS cluster not found or archived.");
    if (context.classification === "ACADEMIC_ELECTIVE" && cluster.track !== "ACADEMIC") throw new CurriculumCorrectionServiceError("Academic electives require an Academic curriculum cluster.");
    if (context.classification === "TECHPRO_ELECTIVE" && cluster.track !== "TECHPRO") throw new CurriculumCorrectionServiceError("TechPro electives require a TechPro curriculum cluster.");
  }
  if (context && context.classification !== "CORE" && policies.length !== uniqueTermIds.length) {
    throw new CurriculumCorrectionServiceError("Existing future elective policy configuration must cover every replacement Term.");
  }

  const sourceWasFinalized = Boolean(source.academicYear.curriculumFinalization);
  if (!sourceWasFinalized && impact.participationCount === 0) {
    throw new CurriculumCorrectionServiceError("Unlocked Curriculum must continue using the ordinary edit or archive workflow.");
  }
  const correctedAt = clock();
  const sourceSnapshot = snapshotOffering({
    subject: { id: source.subjectId, code: source.subjectCode, description: source.subjectDescription },
    gradeLevel: source.gradeLevel,
    terms: source.terms.map(({ academicTermId, academicTerm }) => ({ id: academicTermId, name: academicTerm.name, position: academicTerm.position })),
    shsContext: source.shsContext,
  });
  const replacementSnapshot = snapshotOffering({
    subject,
    gradeLevel: source.gradeLevel,
    terms: replacementTerms.map(({ id, name, position }) => ({ id, name, position })),
    shsContext: context ? {
      ...context,
      curriculumStatus: "SCHOOL_APPROVED",
      cluster,
      approvedById: actorId,
      approvedAt: correctedAt,
    } : null,
  });

  await setCurriculumCorrectionContext(ids.correctionId, transaction);
  await createCurriculumCorrectionIntent({
    id: ids.correctionId,
    academicYearId: source.academicYearId,
    sourceOfferingId: source.id,
    replacementOfferingId: ids.replacementOfferingId,
    effectiveAcademicTermId: effectiveTerm.id,
    reason: values.reason,
    evidenceReference: values.evidenceReference,
    sourceWasFinalized,
    sourceParticipationCount: impact.participationCount,
    sourceConfigurationSnapshot: sourceSnapshot,
    replacementConfigurationSnapshot: replacementSnapshot,
    correctedById: actorId,
    correctedAt,
  }, transaction);
  await archiveCorrectionSource(source.id, correctedAt, transaction);
  const replacement = await createCorrectionReplacement(
    ids.replacementOfferingId,
    source.id,
    source.academicYearId,
    subject,
    values.replacement,
    actorId,
    correctedAt,
    transaction,
  );
  const auditMetadata = {
    correctionId: ids.correctionId,
    academicYearId: source.academicYearId,
    sourceOfferingId: source.id,
    replacementOfferingId: replacement.id,
    effectiveAcademicTermId: effectiveTerm.id,
    reason: values.reason,
    evidenceReference: values.evidenceReference,
    sourceWasFinalized,
    sourceParticipationCount: impact.participationCount,
    sourceResultCount: impact.resultCount,
    sourceConfigurationSnapshot: sourceSnapshot,
    replacementConfigurationSnapshot: replacementSnapshot,
  } satisfies Prisma.InputJsonObject;
  await createAuditLogs([
    { userId: actorId, action: "CREATE", module: "CurriculumCorrection", recordId: ids.correctionId, recordName: `${source.subjectCode} -> ${replacement.subjectCode}`, description: "Created controlled Curriculum Offering correction.", metadata: auditMetadata },
    { userId: actorId, action: "ARCHIVE", module: "SubjectOffering", recordId: source.id, recordName: source.subjectCode, description: "Archived predecessor through controlled Curriculum correction.", metadata: auditMetadata },
    { userId: actorId, action: "CREATE", module: "SubjectOffering", recordId: replacement.id, recordName: replacement.subjectCode, description: "Created prospective replacement through controlled Curriculum correction.", metadata: auditMetadata },
  ], transaction);

  return { correctionId: ids.correctionId, sourceOfferingId: source.id, replacementOfferingId: replacement.id };
}

export async function correctSubjectOfferingService(values: CorrectSubjectOfferingInput) {
  const session = await authorizeCorrection();
  return runSerializableCorrection((transaction) => correctSubjectOfferingInTransaction(values, session.user.id, transaction));
}
