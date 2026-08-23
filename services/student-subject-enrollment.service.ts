import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import { resolveCurrentAcademicTerm } from "@/lib/academic-term-current";
import { interpretFinalizedShsTermResult } from "@/lib/shs-term-result-interpretation";
import prisma from "@/lib/prisma";
import { mapCurrentOfferingIdsToActiveIdentities } from "@/lib/subject-offering-lineage";
import { findShsElectiveEnrollmentPolicyByScope } from "@/repositories/shs-elective-enrollment-policy.repository";
import { findPublishedShsTermResultInterpretationPolicyForEnrollment } from "@/repositories/shs-term-result-interpretation-policy.repository";
import {
  findActiveAcademicYearCalendars,
  findEligibleShsOfferingsForEnrollment,
  findOfferingReplacementAncestors,
  findShsEnrollmentForCurrentTerm,
  findStudentSubjectEnrollments,
} from "@/repositories/student-subject-enrollment.repository";
import type {
  DropStudentSubjectEnrollmentInput,
  ShsCurrentTermProgressionInput,
  StudentSubjectEnrollmentRead,
} from "@/schemas";
import {
  dropShsStudentSubjectEnrollmentInTransaction,
  progressShsCurrentTermInTransaction,
  ShsCurrentTermProgressionError,
} from "@/services/student-subject-enrollment-selection.service";

const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; meta?: { code?: unknown }; cause?: unknown };
  return candidate.code === "40001" || candidate.code === "40P01" || candidate.meta?.code === "40001" || candidate.meta?.code === "40P01" || isRetryableTransactionError(candidate.cause);
}

async function runSerializableMutation<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
    }
  }
  throw new ShsCurrentTermProgressionError("Current-Term SHS operation could not be completed.");
}

export async function getStudentSubjectEnrollments(query: StudentSubjectEnrollmentRead) {
  await requirePermission(Permissions.ENROLLMENT);
  const [rows, interpretationPolicy] = await Promise.all([
    findStudentSubjectEnrollments(query),
    findPublishedShsTermResultInterpretationPolicyForEnrollment(query.enrollmentId),
  ]);
  return rows.map((row) => ({
    ...row,
    terms: row.terms.map((term) => ({
      ...term,
      result: term.result
        ? {
            ...term.result,
            finalResult: term.result.finalResult?.toNumber() ?? null,
            interpretation: interpretFinalizedShsTermResult(
              term.result,
              interpretationPolicy,
            ),
          }
        : null,
    })),
  }));
}

export async function getShsCurrentTermProgressionContext(enrollmentId: string, clock: () => Date = () => new Date()) {
  await requirePermission(Permissions.ENROLLMENT);
  const enrollment = await findShsEnrollmentForCurrentTerm(enrollmentId);
  if (!enrollment) return { ready: false as const, reason: "Enrollment not found." };
  if (enrollment.section.gradeLevel !== "11" && enrollment.section.gradeLevel !== "12") return { ready: false as const, reason: "Current-Term SHS progression is limited to Grade 11 and 12." };
  const calendars = await findActiveAcademicYearCalendars();
  const resolved = resolveCurrentAcademicTerm(calendars, clock);
  const entryTerm = enrollment.entryAcademicTerm;
  const base = {
    enrollmentStatus: enrollment.status,
    academicYearStatus: enrollment.academicYear.status,
    entryTerm,
    shsTrack: enrollment.shsTrack,
    currentTerm: resolved ? { ...resolved.academicTerm, operationalDate: resolved.operationalDate } : null,
  };
  if (enrollment.status !== "ACTIVE" || enrollment.academicYear.status !== "ACTIVE") return { ...base, ready: false as const, reason: "Enrollment and academic year must both be active." };
  if (!entryTerm || !enrollment.shsTrack) return { ...base, ready: false as const, reason: "SHS entry Academic Term and track must be recorded." };
  if (!resolved || resolved.academicYear.id !== enrollment.academicYearId) return { ...base, ready: false as const, reason: "No current Academic Term is available for this Enrollment." };
  const policy = await findShsElectiveEnrollmentPolicyByScope(enrollment.academicYearId, resolved.academicTerm.id, enrollment.section.gradeLevel);
  const [offerings, rows] = await Promise.all([
    findEligibleShsOfferingsForEnrollment(enrollment.academicYearId, enrollment.section.gradeLevel),
    findStudentSubjectEnrollments({ enrollmentId }),
  ]);
  const lineage = await findOfferingReplacementAncestors(offerings.map(({ id }) => id));
  const ancestorIdsByOfferingId = new Map<string, Set<string>>();
  for (const { offeringId, ancestorOfferingId } of lineage) {
    const ancestors = ancestorIdsByOfferingId.get(offeringId) ?? new Set<string>();
    ancestors.add(ancestorOfferingId);
    ancestorIdsByOfferingId.set(offeringId, ancestors);
  }
  const currentRows = rows.filter((row) => row.status === "ACTIVE" && row.terms.some(({ academicTermId }) => academicTermId === resolved.academicTerm.id));
  const currentElectives = currentRows.filter((row) => row.shsClassification === "ACADEMIC_ELECTIVE" || row.shsClassification === "TECHPRO_ELECTIVE");
  const droppedIdentities = new Set(rows.filter((row) => row.status === "DROPPED" && row.terms.some(({ academicTermId }) => academicTermId === resolved.academicTerm.id)).map(({ subjectOfferingId }) => subjectOfferingId));
  const droppedAncestorIdentities = new Set(rows.filter((row) => row.status === "DROPPED").map(({ subjectOfferingId }) => subjectOfferingId));
  const eligibleElectives = offerings.filter((offering) =>
    (offering.shsContext?.classification === "ACADEMIC_ELECTIVE" || offering.shsContext?.classification === "TECHPRO_ELECTIVE") &&
    offering.terms.some(({ academicTermId }) => academicTermId === resolved.academicTerm.id));
  const currentElectiveOfferingIds = mapCurrentOfferingIdsToActiveIdentities(
    currentElectives.map(({ subjectOfferingId }) => subjectOfferingId),
    eligibleElectives.map(({ id }) => id),
    lineage,
  );
  const hasShsHistory = rows.some(({ shsCurriculumStatus }) => shsCurriculumStatus !== null);
  const hasActiveOtherGrade = rows.some(({ gradeLevel, status, shsCurriculumStatus }) => status === "ACTIVE" && shsCurriculumStatus !== null && gradeLevel !== enrollment.section.gradeLevel);
  const progressionBlockReason = hasActiveOtherGrade
    ? "Active SHS participation from another grade must be reconciled before current-Term progression."
    : resolved.academicTerm.position < entryTerm.position
    ? "Current Academic Term cannot precede the student's entry Term."
    : !hasShsHistory && resolved.academicTerm.id !== entryTerm.id
      ? "Initial SHS subject materialization must occur in the student's entry Academic Term."
      : !policy
        ? "An SHS elective policy is required for the current Term and grade."
        : null;
  return {
    ...base,
    ready: progressionBlockReason === null,
    reason: progressionBlockReason,
    policy,
    currentElectiveCount: currentElectives.length,
    currentElectiveOfferingIds,
    core: {
      activeCount: currentRows.filter(({ shsClassification }) => shsClassification === "CORE").length,
      eligibleCount: offerings.filter(({ shsContext }) => shsContext?.classification === "CORE").length,
    },
    eligibleElectives: eligibleElectives.map((offering) => ({
      ...offering,
      selected: currentElectives.some(({ subjectOfferingId }) => subjectOfferingId === offering.id || ancestorIdsByOfferingId.get(offering.id)?.has(subjectOfferingId)),
      dropped: droppedIdentities.has(offering.id) || [...(ancestorIdsByOfferingId.get(offering.id) ?? [])].some((ancestorId) => droppedAncestorIdentities.has(ancestorId)),
    })),
  };
}

export async function progressShsCurrentTermService(values: ShsCurrentTermProgressionInput) {
  const session = await requirePermission(Permissions.ENROLLMENT);
  return runSerializableMutation((transaction) => progressShsCurrentTermInTransaction(values, session.user.id, transaction));
}

export async function dropShsStudentSubjectEnrollmentService(values: DropStudentSubjectEnrollmentInput) {
  const session = await requirePermission(Permissions.ENROLLMENT);
  return runSerializableMutation((transaction) => dropShsStudentSubjectEnrollmentInTransaction(values, session.user.id, transaction));
}
