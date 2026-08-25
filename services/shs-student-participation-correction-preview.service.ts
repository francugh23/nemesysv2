import { Permissions, requirePermission } from "@/lib/authorization";
import { getPhilippineCalendarDate } from "@/lib/academic-term-current";
import {
  findShsParticipationCorrectionEventHistory,
  findShsParticipationCorrectionPolicy,
  findShsParticipationCorrectionPreviewContext,
  findShsParticipationCorrectionReplacementCandidates,
} from "@/repositories/shs-student-participation-correction.repository";
import { findOfferingReplacementAncestors } from "@/repositories/student-subject-enrollment.repository";
import type { ShsStudentParticipationCorrectionPreview } from "@/schemas";
import {
  getShsParticipationCorrectionTypedConfirmationPhrase,
  shsParticipationCorrectionRequiresTypedConfirmation,
  ShsStudentParticipationCorrectionError,
} from "@/services/shs-student-participation-correction-mutation.service";

function isElective(kind: string | null) {
  return kind === "ACADEMIC_ELECTIVE" || kind === "TECHPRO_ELECTIVE";
}

function sourceBlockers(context: NonNullable<Awaited<ReturnType<typeof findShsParticipationCorrectionPreviewContext>>>, source: NonNullable<Awaited<ReturnType<typeof findShsParticipationCorrectionPreviewContext>>>["studentSubjectEnrollments"][number], termId: string, now: Date) {
  const blockers: string[] = [];
  const selectedTerm = source.terms.find(({ academicTermId }) => academicTermId === termId);
  if (!selectedTerm) return ["The source participation does not contain the selected Academic Term."];
  if (context.status !== "ACTIVE" || context.academicYear.status !== "ACTIVE") blockers.push("SHS participation correction requires an active Enrollment and Academic Year.");
  if (!["11", "12"].includes(context.section.gradeLevel) || !context.entryAcademicTermId || !context.shsTrack) blockers.push("SHS participation correction is limited to Grade 11 or 12 Enrollments with immutable entry Term and track facts.");
  if (source.status !== "ACTIVE" || !source.shsClassification || source.gradeLevel !== context.section.gradeLevel || source.shsCurriculumStatus !== "SCHOOL_APPROVED" || !source.shsSourceReference || !source.shsApprovalReference || (isElective(source.shsClassification) && (!source.shsClusterCode || !source.shsClusterName))) blockers.push("The source must be active school-approved SHS participation for this Enrollment.");
  if (source.terms.some(({ academicTerm }) => academicTerm.academicYearId !== context.academicYearId)) blockers.push("Source participation contains an Academic Term outside the Enrollment year.");
  if (source.terms.some(({ result }) => result !== null)) blockers.push("DRAFT and FINALIZED source results must be corrected separately before participation correction.");
  if (source.shsClassification !== "CORE" && (source.selectionAcademicTermId !== termId || source.terms.length !== 1)) blockers.push("Elective correction requires an exact one-Term source participation identity.");
  if (source.shsClassification === "CORE" && source.selectionAcademicTermId !== null) blockers.push("Core correction cannot use a selected-elective Term identity.");
  if (getPhilippineCalendarDate(now) > selectedTerm.academicTerm.endDate.toISOString().slice(0, 10)) blockers.push("Correction cannot create replacement membership for a completed Academic Term.");
  return blockers;
}

export async function getShsStudentParticipationCorrectionContextService(enrollmentId: string) {
  await requirePermission(Permissions.STUDENT_CORRECTIONS);
  const context = await findShsParticipationCorrectionPreviewContext(enrollmentId);
  if (!context) throw new ShsStudentParticipationCorrectionError("Enrollment not found.");
  return {
    enrollmentId: context.id,
    sources: context.studentSubjectEnrollments.filter((source) => source.status === "ACTIVE").map((source) => ({
      id: source.id, subjectCode: source.subjectCode, subjectDescription: source.subjectDescription,
      kind: source.shsClassification,
      terms: source.terms.map(({ academicTermId, academicTerm, result }) => ({ id: academicTermId, name: academicTerm.name, position: academicTerm.position, resultStatus: result?.status ?? null })),
    })),
  };
}

export async function getShsStudentParticipationCorrectionPreviewService(enrollmentId: string, sourceStudentSubjectEnrollmentId: string, sourceAcademicTermId: string, clock: () => Date = () => new Date()): Promise<ShsStudentParticipationCorrectionPreview> {
  await requirePermission(Permissions.STUDENT_CORRECTIONS);
  const context = await findShsParticipationCorrectionPreviewContext(enrollmentId);
  if (!context) throw new ShsStudentParticipationCorrectionError("Enrollment not found.");
  const source = context.studentSubjectEnrollments.find(({ id }) => id === sourceStudentSubjectEnrollmentId);
  if (!source || !source.shsClassification) throw new ShsStudentParticipationCorrectionError("Source SHS participation was not found.");
  const selectedTerm = source.terms.find(({ academicTermId }) => academicTermId === sourceAcademicTermId);
  if (!selectedTerm) throw new ShsStudentParticipationCorrectionError("The source participation does not contain the selected Academic Term.");
  const now = clock();
  const blockers = sourceBlockers(context, source, sourceAcademicTermId, now);
  const plannedTerms = source.shsClassification === "CORE"
    ? source.terms.filter(({ academicTerm }) => academicTerm.position >= selectedTerm.academicTerm.position)
    : [selectedTerm];
  const plannedTermIds = new Set(plannedTerms.map(({ academicTermId }) => academicTermId));
  const electivePolicy = isElective(source.shsClassification)
    ? await findShsParticipationCorrectionPolicy(context.academicYearId, sourceAcademicTermId, context.section.gradeLevel)
    : null;
  const activeElectiveCount = context.studentSubjectEnrollments.filter((row) => row.status === "ACTIVE" && isElective(row.shsClassification) && row.terms.some(({ academicTermId }) => academicTermId === sourceAcademicTermId)).length;
  if (isElective(source.shsClassification) && !electivePolicy) blockers.push("An SHS elective policy is required for the affected Term and grade.");
  if (electivePolicy && (activeElectiveCount < electivePolicy.minimumElectives || activeElectiveCount > electivePolicy.maximumElectives)) blockers.push("Existing affected-Term elective participation is outside the approved policy range.");
  const offerings = await findShsParticipationCorrectionReplacementCandidates(context.academicYearId, context.section.gradeLevel);
  const lineages = await findOfferingReplacementAncestors(offerings.map(({ id }) => id));
  const droppedOfferingIds = new Set(context.studentSubjectEnrollments.filter(({ status }) => status === "DROPPED").map(({ subjectOfferingId }) => subjectOfferingId));
  const candidates = offerings.filter((offering) => {
    if (offering.id === source.subjectOfferingId || offering.shsContext?.classification !== source.shsClassification) return false;
    if (!plannedTerms.every(({ academicTermId }) => offering.terms.some((term) => term.academicTermId === academicTermId))) return false;
    if (context.studentSubjectEnrollments.some((row) => row.status === "ACTIVE" && row.subjectOfferingId === offering.id && row.terms.some(({ academicTermId }) => plannedTermIds.has(academicTermId)))) return false;
    return !droppedOfferingIds.has(offering.id) && !lineages.some(({ offeringId, ancestorOfferingId }) => offeringId === offering.id && droppedOfferingIds.has(ancestorOfferingId));
  }).map((offering) => ({ id: offering.id, subjectCode: offering.subjectCode, subjectDescription: offering.subjectDescription, kind: offering.shsContext!.classification, clusterName: offering.shsContext!.cluster?.name ?? null, termNames: offering.terms.map(({ academicTerm }) => academicTerm.name) }));
  if (!candidates.length) blockers.push("No active school-approved replacement Offering is valid for the exact correction scope.");
  return {
    enrollmentId, sourceStudentSubjectEnrollmentId, sourceAcademicTermId, eligible: blockers.length === 0, blockers,
    source: { subjectCode: source.subjectCode, subjectDescription: source.subjectDescription, kind: source.shsClassification, selectedTerm: { id: selectedTerm.academicTermId, name: selectedTerm.academicTerm.name, position: selectedTerm.academicTerm.position, startDate: selectedTerm.academicTerm.startDate, endDate: selectedTerm.academicTerm.endDate, resultStatus: selectedTerm.result?.status ?? null }, plannedTerms: plannedTerms.map(({ academicTermId, academicTerm }) => ({ id: academicTermId, name: academicTerm.name, position: academicTerm.position })), resultStates: source.terms.map(({ academicTermId, academicTerm, result }) => ({ id: academicTermId, name: academicTerm.name, status: result?.status ?? null })) },
    candidates, policy: electivePolicy ? { ...electivePolicy, activeElectiveCount } : null,
    requiresTypedConfirmation: shsParticipationCorrectionRequiresTypedConfirmation(selectedTerm.academicTerm.startDate, now),
    typedConfirmationPhrase: getShsParticipationCorrectionTypedConfirmationPhrase(source.subjectCode),
  };
}

export async function getShsStudentParticipationCorrectionHistoryService(enrollmentId: string) {
  await requirePermission(Permissions.STUDENT_CORRECTIONS);
  return findShsParticipationCorrectionEventHistory(enrollmentId);
}
