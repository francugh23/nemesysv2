import { Prisma } from "@/app/generated/prisma/client";
import { resolveCurrentAcademicTerm } from "@/lib/academic-term-current";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  findShsElectiveEnrollmentPolicyByScope,
  lockShsElectiveEnrollmentPolicy,
  lockShsElectiveEnrollmentPolicyScope,
} from "@/repositories/shs-elective-enrollment-policy.repository";
import {
  createProgressiveShsCoreParticipation,
  createProgressiveShsElectiveParticipation,
  dropActiveStudentSubjectEnrollment,
  findActiveAcademicYearCalendars,
  findApprovedShsCoreOfferingIds,
  findOfferingReplacementAncestors,
  findShsStudentSubjectEnrollmentHistory,
  lockActiveShsEnrollmentForCurriculumSelection,
  lockActiveShsStudentSubjectEnrollments,
  lockShsOfferingsById,
  replaceActiveStudentSubjectEnrollment,
  setProgressiveShsCoreReplacementCapability,
} from "@/repositories/student-subject-enrollment.repository";
import type {
  DropStudentSubjectEnrollmentInput,
  ShsCurrentTermProgressionInput,
} from "@/schemas";

export class ShsCurrentTermProgressionError extends Error {}

type Clock = () => Date;
type LockedOffering = Awaited<ReturnType<typeof lockShsOfferingsById>>[number];

function isElective(classification: string | null) {
  return classification === "ACADEMIC_ELECTIVE" || classification === "TECHPRO_ELECTIVE";
}

function isOfferingEligible(
  offering: LockedOffering,
  academicYearId: string,
  gradeLevel: string,
) {
  const context = offering.shsContext;
  return offering.academicYearId === academicYearId &&
    offering.gradeLevel === gradeLevel &&
    !offering.deletedAt &&
    context?.curriculumStatus === "SCHOOL_APPROVED" &&
    (context.classification === "CORE" ||
      (isElective(context.classification) && context.cluster && !context.cluster.deletedAt));
}

async function lockAndResolveCurrentTerm(
  enrollmentId: string,
  transaction: Prisma.TransactionClient,
  clock: Clock,
) {
  const enrollment = await lockActiveShsEnrollmentForCurriculumSelection(enrollmentId, transaction);
  if (!enrollment) throw new ShsCurrentTermProgressionError("Enrollment not found.");
  if (enrollment.status !== "ACTIVE") throw new ShsCurrentTermProgressionError("Only active enrollments can manage current-Term SHS participation.");
  if (enrollment.academicYearStatus !== "ACTIVE") throw new ShsCurrentTermProgressionError("Enrollment is read-only because its academic year is not active.");
  if (enrollment.gradeLevel !== "11" && enrollment.gradeLevel !== "12") throw new ShsCurrentTermProgressionError("Current-Term SHS participation is limited to Grade 11 and 12 enrollments.");
  if (!enrollment.entryAcademicTermId || !enrollment.shsTrack) throw new ShsCurrentTermProgressionError("SHS entry Academic Term and track must be recorded before subject progression.");

  if (!(await lockShsElectiveEnrollmentPolicyScope(enrollment.academicYearId, transaction))) {
    throw new ShsCurrentTermProgressionError("Enrollment academic year not found.");
  }
  const calendars = await findActiveAcademicYearCalendars(transaction);
  const resolved = resolveCurrentAcademicTerm(calendars, clock);
  if (!resolved) throw new ShsCurrentTermProgressionError("No Academic Term is active for the Philippine operational date.");
  if (resolved.academicYear.id !== enrollment.academicYearId) throw new ShsCurrentTermProgressionError("Enrollment does not belong to the currently active academic year.");
  const entryTerm = resolved.academicYear.terms.find(({ id }) => id === enrollment.entryAcademicTermId);
  if (!entryTerm) throw new ShsCurrentTermProgressionError("Enrollment entry Academic Term is not configured in its academic year.");
  if (resolved.academicTerm.position < entryTerm.position) throw new ShsCurrentTermProgressionError("Current Academic Term cannot precede the student's entry Term.");
  return { enrollment, resolved, entryTerm };
}

async function lockRequiredPolicy(
  academicYearId: string,
  academicTermId: string,
  gradeLevel: string,
  transaction: Prisma.TransactionClient,
) {
  const found = await findShsElectiveEnrollmentPolicyByScope(academicYearId, academicTermId, gradeLevel, transaction);
  if (!found) throw new ShsCurrentTermProgressionError("An SHS elective policy is required for the current Academic Term and grade.");
  if (!(await lockShsElectiveEnrollmentPolicy(found.id, transaction))) {
    throw new ShsCurrentTermProgressionError("The current SHS elective policy changed. Refresh and try again.");
  }
  const policy = await findShsElectiveEnrollmentPolicyByScope(academicYearId, academicTermId, gradeLevel, transaction);
  if (!policy || policy.id !== found.id) throw new ShsCurrentTermProgressionError("The current SHS elective policy changed. Refresh and try again.");
  return policy;
}

export async function progressShsCurrentTermInTransaction(
  values: ShsCurrentTermProgressionInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
  clock: Clock = () => new Date(),
) {
  const { enrollment, resolved, entryTerm } = await lockAndResolveCurrentTerm(values.enrollmentId, transaction, clock);
  const currentTerm = resolved.academicTerm;
  const policy = await lockRequiredPolicy(enrollment.academicYearId, currentTerm.id, enrollment.gradeLevel, transaction);
  const active = await lockActiveShsStudentSubjectEnrollments(enrollment.id, transaction);
  const history = await findShsStudentSubjectEnrollmentHistory(enrollment.id, transaction);
  if (active.some(({ gradeLevel }) => gradeLevel !== enrollment.gradeLevel)) {
    throw new ShsCurrentTermProgressionError("Active SHS participation from another grade must be reconciled before current-Term progression.");
  }
  const initialMaterialization = history.length === 0;
  if (initialMaterialization && entryTerm.id !== currentTerm.id) {
    throw new ShsCurrentTermProgressionError("Initial SHS subject materialization must occur in the student's entry Academic Term.");
  }

  const coreCandidates = await findApprovedShsCoreOfferingIds(enrollment.academicYearId, enrollment.gradeLevel, transaction);
  const affectedIds = [...new Set([...values.subjectOfferingIds, ...coreCandidates.map(({ id }) => id)])];
  const lockedOfferings = await lockShsOfferingsById(affectedIds, transaction);
  const lineage = await findOfferingReplacementAncestors(affectedIds, transaction);
  const ancestorIdsByOfferingId = new Map<string, Set<string>>();
  for (const { offeringId, ancestorOfferingId } of lineage) {
    const ancestors = ancestorIdsByOfferingId.get(offeringId) ?? new Set<string>();
    ancestors.add(ancestorOfferingId);
    ancestorIdsByOfferingId.set(offeringId, ancestors);
  }
  const offeringById = new Map(lockedOfferings.map((offering) => [offering.id, offering]));
  if (affectedIds.some((id) => !offeringById.has(id))) throw new ShsCurrentTermProgressionError("A selected SHS Offering no longer exists.");
  for (const offering of lockedOfferings) {
    if (!isOfferingEligible(offering, enrollment.academicYearId, enrollment.gradeLevel)) {
      throw new ShsCurrentTermProgressionError("Offerings must remain active, school-approved SSHS Offerings for this enrollment's year and grade.");
    }
  }

  const requested = values.subjectOfferingIds.map((id) => offeringById.get(id)!);
  if (requested.some(({ shsContext }) => !isElective(shsContext?.classification ?? null))) {
    throw new ShsCurrentTermProgressionError("Only elective Offerings may be selected explicitly; Core is materialized automatically.");
  }
  if (requested.some(({ terms }) => !terms.some(({ academicTermId }) => academicTermId === currentTerm.id))) {
    throw new ShsCurrentTermProgressionError("Elective Offerings must be approved for the current Academic Term.");
  }

  const droppedCurrentIdentities = new Set(history
    .filter((row) => row.status === "DROPPED" && row.terms.some(({ academicTermId }) => academicTermId === currentTerm.id))
    .map(({ subjectOfferingId }) => subjectOfferingId));
  const droppedAncestorIdentities = new Set(history
    .filter((row) => row.status === "DROPPED")
    .map(({ subjectOfferingId }) => subjectOfferingId));
  if (requested.some(({ id }) => droppedCurrentIdentities.has(id) || [...(ancestorIdsByOfferingId.get(id) ?? [])].some((ancestorId) => droppedAncestorIdentities.has(ancestorId)))) {
    throw new ShsCurrentTermProgressionError("A dropped Offering cannot be selected again in the same Term, and its replacement descendants remain blocked for the Academic Year.");
  }

  const activeCurrentElectives = active.filter((row) =>
    row.gradeLevel === enrollment.gradeLevel && isElective(row.shsClassification) && row.terms.some(({ academicTermId }) => academicTermId === currentTerm.id));
  const activeCurrentOfferingIds = new Set(activeCurrentElectives.map(({ subjectOfferingId }) => subjectOfferingId));
  const newElectives = requested.filter(({ id }) =>
    !activeCurrentOfferingIds.has(id) &&
    ![...(ancestorIdsByOfferingId.get(id) ?? [])].some((ancestorId) => activeCurrentOfferingIds.has(ancestorId)));
  const prospectiveCount = activeCurrentElectives.length + newElectives.length;
  if (prospectiveCount < policy.minimumElectives || prospectiveCount > policy.maximumElectives) {
    throw new ShsCurrentTermProgressionError(`Current-Term elective count must be between ${policy.minimumElectives} and ${policy.maximumElectives}.`);
  }

  const droppedOfferingIds = new Set(history.filter(({ status }) => status === "DROPPED").map(({ subjectOfferingId }) => subjectOfferingId));
  const coreStartPosition = initialMaterialization ? entryTerm.position : currentTerm.position;
  const newCores = lockedOfferings.flatMap((offering) => {
    const ancestorIds = ancestorIdsByOfferingId.get(offering.id) ?? new Set<string>();
    if (
      offering.shsContext?.classification !== "CORE" ||
      droppedOfferingIds.has(offering.id) ||
      [...ancestorIds].some((ancestorId) => droppedOfferingIds.has(ancestorId))
    ) return [];
    const ancestorTermIds = new Set(active
      .filter(({ subjectOfferingId, shsClassification }) =>
        shsClassification === "CORE" && ancestorIds.has(subjectOfferingId))
      .flatMap(({ terms }) => terms.map(({ academicTermId }) => academicTermId)));
    const academicTermIds = offering.terms
      .filter(({ academicTerm }) => academicTerm.position >= coreStartPosition)
      .map(({ academicTermId }) => academicTermId);
    const activeCore = active.find(({ subjectOfferingId, shsClassification }) => subjectOfferingId === offering.id && shsClassification === "CORE");
    const activeTermIds = new Set(activeCore?.terms.map(({ academicTermId }) => academicTermId));
    const uncoveredTermIds = academicTermIds.filter((academicTermId) =>
      !ancestorTermIds.has(academicTermId) && !activeTermIds.has(academicTermId));
    return uncoveredTermIds.length ? [{ offering, academicTermIds: uncoveredTermIds, activeCore }] : [];
  });

  const replacedCores = [];
  const createdCores = [];
  const transitionAt = clock();
  for (const { offering, academicTermIds, activeCore } of newCores) {
    if (activeCore) {
      await setProgressiveShsCoreReplacementCapability(activeCore.id, transaction);
      if (!(await replaceActiveStudentSubjectEnrollment(activeCore.id, transitionAt, transaction))) {
        throw new ShsCurrentTermProgressionError("Existing Core participation changed. Refresh and try again.");
      }
      replacedCores.push(activeCore);
    }
    createdCores.push(await createProgressiveShsCoreParticipation(
      enrollment.id,
      offering,
      academicTermIds,
      actorId,
      transaction,
    ));
  }
  const createdElectives = [];
  for (const offering of newElectives) {
    createdElectives.push(await createProgressiveShsElectiveParticipation(enrollment.id, offering, currentTerm.id, actorId, transaction));
  }
  await createAuditLogs([
    ...replacedCores.map((row) => ({
      userId: actorId,
      action: "UPDATE",
      module: "StudentSubjectEnrollment",
      recordId: row.id,
      recordName: row.subjectCode,
      description: "Replaced incomplete legacy SHS Core participation during explicit current-Term progression.",
      metadata: { enrollmentId: enrollment.id, currentAcademicTermId: currentTerm.id, previousStatus: "ACTIVE", status: "REPLACED" },
    })),
    ...createdCores.map((row) => ({
      userId: actorId,
      action: "CREATE",
      module: "StudentSubjectEnrollment",
      recordId: row.id,
      recordName: row.subjectCode,
      description: "Materialized progressive SHS Core participation.",
      metadata: { enrollmentId: enrollment.id, currentAcademicTermId: currentTerm.id, classification: "CORE" },
    })),
    ...createdElectives.map((row) => ({
      userId: actorId,
      action: "CREATE",
      module: "StudentSubjectEnrollment",
      recordId: row.id,
      recordName: row.subjectCode,
      description: "Selected a school-approved SHS elective for the current Academic Term.",
      metadata: { enrollmentId: enrollment.id, selectionAcademicTermId: currentTerm.id, resultingElectiveCount: prospectiveCount, policyId: policy.id },
    })),
  ], transaction);
  return {
    createdCore: createdCores.length,
    replacedCore: replacedCores.length,
    createdElectives: createdElectives.length,
    retainedElectives: requested.length - newElectives.length,
    currentElectiveCount: prospectiveCount,
    currentAcademicTermId: currentTerm.id,
  };
}

export async function dropShsStudentSubjectEnrollmentInTransaction(
  values: DropStudentSubjectEnrollmentInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
  clock: Clock = () => new Date(),
) {
  const { enrollment, resolved } = await lockAndResolveCurrentTerm(values.enrollmentId, transaction, clock);
  const currentTerm = resolved.academicTerm;
  const policyCandidate = await findShsElectiveEnrollmentPolicyByScope(enrollment.academicYearId, currentTerm.id, enrollment.gradeLevel, transaction);
  if (policyCandidate) {
    if (!(await lockShsElectiveEnrollmentPolicy(policyCandidate.id, transaction))) {
      throw new ShsCurrentTermProgressionError("The current SHS elective policy changed. Refresh and try again.");
    }
  }
  const active = await lockActiveShsStudentSubjectEnrollments(enrollment.id, transaction);
  const target = active.find(({ id }) => id === values.studentSubjectEnrollmentId);
  if (!target || !target.shsCurriculumStatus) throw new ShsCurrentTermProgressionError("Active SHS subject participation not found for this Enrollment.");
  if (!target.terms.some(({ academicTermId }) => academicTermId === currentTerm.id)) {
    throw new ShsCurrentTermProgressionError("Only an SHS subject covering the current Academic Term can be dropped.");
  }

  const droppedAt = clock();
  const dropped = await dropActiveStudentSubjectEnrollment(target.id, droppedAt, values.reason, transaction);
  if (!dropped) throw new ShsCurrentTermProgressionError("Subject participation is no longer active.");
  const resultingElectiveCount = active.filter((row) =>
    row.id !== target.id && isElective(row.shsClassification) && row.terms.some(({ academicTermId }) => academicTermId === currentTerm.id)).length;
  const policyException = isElective(target.shsClassification) && policyCandidate && resultingElectiveCount < policyCandidate.minimumElectives
    ? { belowMinimum: true as const, minimumElectives: policyCandidate.minimumElectives, resultingElectiveCount }
    : null;

  await createAuditLogs([{
    userId: actorId,
    action: "UPDATE",
    module: "StudentSubjectEnrollment",
    recordId: dropped.id,
    recordName: dropped.subjectCode,
    description: "Dropped the entire SHS Student Subject Enrollment row while preserving immutable Term history.",
    metadata: {
      enrollmentId: enrollment.id,
      currentAcademicTermId: currentTerm.id,
      previousStatus: "ACTIVE",
      status: "DROPPED",
      reason: values.reason,
      policyException,
    },
  }], transaction);
  return { dropped, policyException };
}
