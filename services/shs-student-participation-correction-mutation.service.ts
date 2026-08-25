import { randomUUID } from "node:crypto";

import { Prisma } from "@/app/generated/prisma/client";
import { getPhilippineCalendarDate } from "@/lib/academic-term-current";
import {
  executeShsParticipationCorrection,
  findShsParticipationCorrectionHistory,
  findShsParticipationCorrectionReference,
  lockShsParticipationCorrectionAcademicYear,
  lockShsParticipationCorrectionConflicts,
  lockShsParticipationCorrectionEnrollment,
  lockShsParticipationCorrectionOffering,
  lockShsParticipationCorrectionPolicy,
  lockShsParticipationCorrectionSource,
} from "@/repositories/shs-student-participation-correction.repository";
import { findOfferingReplacementAncestors } from "@/repositories/student-subject-enrollment.repository";
import { lockStudentForEnrollmentSynchronization } from "@/repositories/student.repository";
import type { CorrectShsStudentParticipationInput } from "@/schemas";

export class ShsStudentParticipationCorrectionError extends Error {}

export function getShsParticipationCorrectionTypedConfirmationPhrase(sourceCode: string) {
  return `CORRECT ${sourceCode} PARTICIPATION`;
}

export function shsParticipationCorrectionRequiresTypedConfirmation(termStartDate: Date, now: Date = new Date()) {
  return getPhilippineCalendarDate(now) >= termStartDate.toISOString().slice(0, 10);
}

function isElective(kind: string) {
  return kind === "ACADEMIC_ELECTIVE" || kind === "TECHPRO_ELECTIVE";
}

export async function correctShsStudentParticipationInTransaction(
  enrollmentId: string,
  values: CorrectShsStudentParticipationInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
  clock: () => Date = () => new Date(),
  correctionId = randomUUID(),
) {
  const reference = await findShsParticipationCorrectionReference(enrollmentId, transaction);
  if (!reference) throw new ShsStudentParticipationCorrectionError("Enrollment not found.");

  // Lock order is deliberately shared with SHS progression/result operations.
  const [student] = await lockStudentForEnrollmentSynchronization(reference.studentId, transaction);
  const enrollment = await lockShsParticipationCorrectionEnrollment(enrollmentId, transaction);
  if (!student || !enrollment || enrollment.studentId !== reference.studentId) {
    throw new ShsStudentParticipationCorrectionError("Enrollment changed. Refresh and try again.");
  }
  await lockShsParticipationCorrectionAcademicYear(enrollment.academicYearId, transaction);
  const source = await lockShsParticipationCorrectionSource(values.sourceStudentSubjectEnrollmentId, transaction);
  const replacementOffering = await lockShsParticipationCorrectionOffering(values.replacementSubjectOfferingId, transaction);
  if (!source || !replacementOffering) throw new ShsStudentParticipationCorrectionError("Source participation or replacement Offering was not found.");

  const sourceTerm = source.terms.find(({ academicTermId }) => academicTermId === values.sourceAcademicTermId);
  if (!sourceTerm) throw new ShsStudentParticipationCorrectionError("The source participation does not contain the affected Academic Term.");
  const policy = isElective(source.shsClassification ?? "")
    ? await lockShsParticipationCorrectionPolicy(enrollment.academicYearId, sourceTerm.academicTermId, enrollment.gradeLevel, transaction)
    : null;
  const history = await findShsParticipationCorrectionHistory(enrollment.id, transaction);
  const lineage = await findOfferingReplacementAncestors([replacementOffering.id], transaction);
  await lockShsParticipationCorrectionConflicts(enrollment.id, transaction);

  if (enrollment.status !== "ACTIVE" || enrollment.deletedAt || enrollment.academicYearStatus !== "ACTIVE") {
    throw new ShsStudentParticipationCorrectionError("SHS participation correction requires an active Enrollment and Academic Year.");
  }
  if (!["11", "12"].includes(enrollment.gradeLevel) || !enrollment.entryAcademicTermId || !enrollment.shsTrack) {
    throw new ShsStudentParticipationCorrectionError("SHS participation correction is limited to Grade 11 or 12 Enrollments with immutable entry Term and track facts.");
  }
  if (source.enrollmentId !== enrollment.id || source.status !== "ACTIVE" || !source.shsClassification || source.gradeLevel !== enrollment.gradeLevel ||
      source.shsCurriculumStatus !== "SCHOOL_APPROVED" || !source.shsSourceReference || !source.shsApprovalReference ||
      (isElective(source.shsClassification) && (!source.shsClusterCode || !source.shsClusterName))) {
    throw new ShsStudentParticipationCorrectionError("The source must be active SHS participation for this Enrollment.");
  }
  if (source.terms.some(({ academicYearId }) => academicYearId !== enrollment.academicYearId)) {
    throw new ShsStudentParticipationCorrectionError("Source participation contains an Academic Term outside the Enrollment year.");
  }
  if (source.terms.some(({ resultId }) => resultId !== null)) {
    throw new ShsStudentParticipationCorrectionError("DRAFT and FINALIZED source results must be corrected separately before participation correction.");
  }
  if (replacementOffering.deletedAt || replacementOffering.academicYearId !== enrollment.academicYearId || replacementOffering.gradeLevel !== enrollment.gradeLevel ||
      replacementOffering.curriculumStatus !== "SCHOOL_APPROVED" || !replacementOffering.sourceReference || !replacementOffering.approvalReference ||
      replacementOffering.classification !== source.shsClassification ||
      (isElective(source.shsClassification) && (!replacementOffering.clusterId || replacementOffering.clusterDeletedAt))) {
    throw new ShsStudentParticipationCorrectionError("Replacement must be an active, school-approved SHS Offering with matching classification and active cluster context.");
  }
  const sourceKind = source.shsClassification;
  const sourceTermIds = source.terms.map(({ academicTermId }) => academicTermId);
  const replacementOfferingTermIds = new Set(replacementOffering.terms.map(({ academicTermId }) => academicTermId));
  const plannedTermIds = sourceKind === "CORE"
    ? source.terms.filter(({ position }) => position >= sourceTerm.position).map(({ academicTermId }) => academicTermId)
    : [sourceTerm.academicTermId];
  if (!plannedTermIds.length || plannedTermIds.some((academicTermId) => !replacementOfferingTermIds.has(academicTermId))) {
    throw new ShsStudentParticipationCorrectionError("Replacement Offering does not cover the exact safe correction Term scope.");
  }
  if (shsParticipationCorrectionRequiresTypedConfirmation(sourceTerm.startDate, clock()) &&
      values.typedConfirmation !== getShsParticipationCorrectionTypedConfirmationPhrase(source.subjectCode)) {
    throw new ShsStudentParticipationCorrectionError("Type the exact correction confirmation phrase to continue after the Academic Term has started.");
  }
  if (sourceKind !== "CORE" && (source.selectionAcademicTermId !== sourceTerm.academicTermId || sourceTermIds.length !== 1)) {
    throw new ShsStudentParticipationCorrectionError("Elective correction requires an exact one-Term source participation identity.");
  }
  if (sourceKind === "CORE" && source.selectionAcademicTermId !== null) {
    throw new ShsStudentParticipationCorrectionError("Core correction cannot use a selected-elective Term identity.");
  }
  if (isElective(sourceKind) && !policy) {
    throw new ShsStudentParticipationCorrectionError("An SHS elective policy is required for the affected Term and grade.");
  }
  const activeDuplicate = history.some((row) => row.status === "ACTIVE" && row.subjectOfferingId === replacementOffering.id && row.terms.some(({ academicTermId }) => plannedTermIds.includes(academicTermId)));
  if (activeDuplicate) throw new ShsStudentParticipationCorrectionError("Replacement Offering already has active participation in the affected Term scope.");
  const droppedOfferingIds = new Set(history.filter((row) => row.status === "DROPPED").map(({ subjectOfferingId }) => subjectOfferingId));
  if (droppedOfferingIds.has(replacementOffering.id) || lineage.some(({ ancestorOfferingId }) => droppedOfferingIds.has(ancestorOfferingId))) {
    throw new ShsStudentParticipationCorrectionError("A DROPPED Offering or compatible ancestor cannot be corrected through a replacement descendant.");
  }
  if (history.some((row) => row.id === source.id && row.status !== "ACTIVE")) {
    throw new ShsStudentParticipationCorrectionError("Already corrected participation cannot be corrected again.");
  }
  if (isElective(sourceKind) && policy) {
    const currentElectiveCount = history.filter((row) => row.status === "ACTIVE" && isElective(row.shsClassification ?? "") && row.terms.some(({ academicTermId }) => academicTermId === sourceTerm.academicTermId)).length;
    if (currentElectiveCount < policy.minimumElectives || currentElectiveCount > policy.maximumElectives) {
      throw new ShsStudentParticipationCorrectionError("Existing affected-Term elective participation is outside the approved policy range.");
    }
  }

  const correctedAt = clock();
  if (getPhilippineCalendarDate(correctedAt) > sourceTerm.endDate.toISOString().slice(0, 10)) {
    throw new ShsStudentParticipationCorrectionError("Correction cannot create replacement membership for a completed Academic Term.");
  }
  const result = await executeShsParticipationCorrection({
    enrollmentId: enrollment.id,
    sourceStudentSubjectEnrollmentId: source.id,
    sourceAcademicTermId: sourceTerm.academicTermId,
    replacementSubjectOfferingId: replacementOffering.id,
    reason: values.reason,
    evidenceReference: values.evidenceReference,
    actorId,
    correctionId,
  }, transaction);
  if (!result) throw new ShsStudentParticipationCorrectionError("Controlled SHS participation correction could not be completed.");
  return result;
}
