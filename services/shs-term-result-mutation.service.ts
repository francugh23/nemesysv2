import { Prisma } from "@/app/generated/prisma/client";
import { getPhilippineCalendarDate } from "@/lib/academic-term-current";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createShsTermResultDraft,
  createShsTermResultRevision,
  finalizeShsTermResult,
  lockAcademicYearForShsTermResult,
  lockEnrollmentForShsTermResult,
  lockShsTermResult,
  lockShsTermResultParticipationCorrectionState,
  lockShsTermResultRevisions,
  lockStudentSubjectEnrollmentForTermResult,
  lockStudentSubjectEnrollmentTermForResult,
  updateShsTermResultDraft,
} from "@/repositories/shs-term-result.repository";
import type {
  FinalizeShsTermResultInput,
  ReviseFinalizedShsTermResultInput,
  SaveShsTermResultDraftInput,
} from "@/schemas";

export class ShsTermResultError extends Error {}

export function getShsTermResultRevisionTypedConfirmationPhrase(subjectCode: string, termName: string) {
  return `REVISE ${subjectCode} ${termName} RESULT`;
}

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

async function lockAndValidateParticipation(
  values: FinalizeShsTermResultInput,
  transaction: Prisma.TransactionClient,
) {
  if (!(await lockEnrollmentForShsTermResult(values.enrollmentId, transaction))) {
    throw new ShsTermResultError("Enrollment not found.");
  }
  const participation = await lockStudentSubjectEnrollmentForTermResult(
    values.studentSubjectEnrollmentId,
    transaction,
  );
  if (!participation || participation.enrollmentId !== values.enrollmentId) {
    throw new ShsTermResultError("SHS subject participation does not belong to this Enrollment.");
  }
  if (
    participation.status !== "ACTIVE" ||
    !participation.shsCurriculumStatus ||
    (participation.gradeLevel !== "11" && participation.gradeLevel !== "12")
  ) {
    throw new ShsTermResultError("Only active SHS subject participation may receive a Term Result.");
  }
  const membership = await lockStudentSubjectEnrollmentTermForResult(
    participation.id,
    values.academicTermId,
    transaction,
  );
  if (!membership) {
    throw new ShsTermResultError("Academic Term is not an immutable membership of this subject participation.");
  }
  return { participation, membership };
}

export async function saveShsTermResultDraftInTransaction(
  values: SaveShsTermResultDraftInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
  clock: () => Date = () => new Date(),
) {
  const { participation, membership } = await lockAndValidateParticipation(values, transaction);
  await lockAcademicYearForShsTermResult(values.enrollmentId, transaction);
  const operationalDate = getPhilippineCalendarDate(clock());
  if (operationalDate < dateOnly(membership.academicTerm.startDate)) {
    throw new ShsTermResultError("A draft result cannot be recorded before the applicable Academic Term starts.");
  }
  const existing = await lockShsTermResult(participation.id, membership.academicTermId, transaction);
  if (existing?.status === "FINALIZED") {
    throw new ShsTermResultError("Finalized SHS Term Results are immutable.");
  }
  const result = existing
    ? await updateShsTermResultDraft(existing.id, values.finalResult, transaction)
    : await createShsTermResultDraft(
        {
          studentSubjectEnrollmentId: participation.id,
          academicTermId: membership.academicTermId,
          finalResult: values.finalResult,
          actorId,
        },
        transaction,
      );
  if (!result) throw new ShsTermResultError("The draft result changed. Refresh and try again.");
  await createAuditLogs([{
    userId: actorId,
    action: existing ? "UPDATE" : "CREATE",
    module: "ShsTermResult",
    recordId: result.id,
    recordName: `${participation.subjectCode} | ${membership.academicTerm.name}`,
    description: existing ? "Updated a draft SHS Term Result." : "Created a draft SHS Term Result.",
    metadata: {
      enrollmentId: values.enrollmentId,
      studentSubjectEnrollmentId: participation.id,
      academicTermId: membership.academicTermId,
      status: "DRAFT",
      finalResult: values.finalResult,
      previousFinalResult: existing?.finalResult?.toNumber() ?? null,
    },
  }], transaction);
  return { ...result, finalResult: result.finalResult?.toNumber() ?? null };
}

export async function reviseFinalizedShsTermResultInTransaction(
  values: ReviseFinalizedShsTermResultInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  const { participation, membership } = await lockAndValidateParticipation(values, transaction);
  await lockAcademicYearForShsTermResult(values.enrollmentId, transaction);
  const root = await lockShsTermResult(participation.id, membership.academicTermId, transaction);
  if (!root || root.id !== values.shsTermResultId || root.status !== "FINALIZED" || root.finalResult === null) {
    throw new ShsTermResultError("A finalized SHS Term Result is required for revision.");
  }
  const revisions = await lockShsTermResultRevisions(root.id, transaction);
  if ((await lockShsTermResultParticipationCorrectionState(participation.id, transaction)).length) {
    throw new ShsTermResultError("Result revision cannot be composed with subject participation correction history.");
  }
  const latest = revisions.at(-1) ?? null;
  const prior = latest?.revisedFinalResult ?? root.finalResult;
  if ((latest?.id ?? null) !== values.expectedLatestRevisionId || (latest?.sequence ?? 0) !== values.expectedLatestRevisionSequence || prior.toNumber() !== values.expectedPriorAuthoritativeResult) {
    throw new ShsTermResultError("The result revision chain changed. Refresh and try again.");
  }
  if (prior.toNumber() === values.revisedFinalResult) throw new ShsTermResultError("The revised result must differ from the current authoritative result.");
  if (values.typedConfirmation !== getShsTermResultRevisionTypedConfirmationPhrase(participation.subjectCode, membership.academicTerm.name)) {
    throw new ShsTermResultError("Type the exact result revision confirmation phrase to continue.");
  }
  const revision = await createShsTermResultRevision({
    shsTermResultId: root.id,
    sequence: (latest?.sequence ?? 0) + 1,
    predecessorRevisionId: latest?.id ?? null,
    originalFinalResultSnapshot: root.finalResult.toNumber(),
    priorAuthoritativeResult: prior.toNumber(),
    revisedFinalResult: values.revisedFinalResult,
    reason: values.reason,
    evidenceReference: values.evidenceReference,
    revisedById: actorId,
  }, transaction);
  await createAuditLogs([{
    userId: actorId, action: "CREATE", module: "ShsTermResultRevision", recordId: revision.id,
    recordName: `${participation.subjectCode} | ${membership.academicTerm.name}`,
    description: "Recorded an immutable SHS Term Result revision.",
    metadata: { enrollmentId: values.enrollmentId, studentSubjectEnrollmentId: participation.id, academicTermId: membership.academicTermId, shsTermResultId: root.id, sequence: revision.sequence, originalFinalResult: root.finalResult.toNumber(), priorAuthoritativeResult: prior.toNumber(), revisedFinalResult: values.revisedFinalResult, reason: values.reason, evidenceReference: values.evidenceReference },
  }], transaction);
  return revision;
}

export async function finalizeShsTermResultInTransaction(
  values: FinalizeShsTermResultInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
  clock: () => Date = () => new Date(),
) {
  const { participation, membership } = await lockAndValidateParticipation(values, transaction);
  if (getPhilippineCalendarDate(clock()) < dateOnly(membership.academicTerm.endDate)) {
    throw new ShsTermResultError("An SHS Term Result can be finalized only on or after the Academic Term end date.");
  }
  const existing = await lockShsTermResult(participation.id, membership.academicTermId, transaction);
  if (!existing) throw new ShsTermResultError("Save a draft result before finalizing it.");
  if (existing.status === "FINALIZED") throw new ShsTermResultError("Finalized SHS Term Results are immutable.");
  if (existing.finalResult === null) throw new ShsTermResultError("A numeric final result is required before finalization.");
  const finalizedAt = clock();
  const result = await finalizeShsTermResult(existing.id, actorId, finalizedAt, transaction);
  if (!result) throw new ShsTermResultError("The draft result changed. Refresh and try again.");
  await createAuditLogs([{
    userId: actorId,
    action: "UPDATE",
    module: "ShsTermResult",
    recordId: result.id,
    recordName: `${participation.subjectCode} | ${membership.academicTerm.name}`,
    description: "Finalized an immutable SHS Term Result as evidence only.",
    metadata: {
      enrollmentId: values.enrollmentId,
      studentSubjectEnrollmentId: participation.id,
      academicTermId: membership.academicTermId,
      previousStatus: "DRAFT",
      status: "FINALIZED",
      finalResult: result.finalResult?.toNumber(),
    },
  }], transaction);
  return { ...result, finalResult: result.finalResult?.toNumber() ?? null };
}
