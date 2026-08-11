import { Prisma } from "@/app/generated/prisma/client";
import { createAuditLogs } from "@/repositories/audit.repository";
import { createShsStudentSubjectEnrollmentsFromSelections, findEligibleShsOfferingsForEnrollment, findStudentSubjectEnrollments, lockActiveShsEnrollmentForCurriculumSelection, replaceChangedShsStudentSubjectEnrollments } from "@/repositories/student-subject-enrollment.repository";
import type { ShsStudentCurriculumSelectionInput } from "@/schemas";

export class ShsStudentCurriculumSelectionError extends Error {}

export async function selectShsStudentCurriculumInTransaction(
  values: ShsStudentCurriculumSelectionInput,
  actorId: string,
  tx: Prisma.TransactionClient,
) {
  const enrollment = await lockActiveShsEnrollmentForCurriculumSelection(values.enrollmentId, tx);
  if (!enrollment) throw new ShsStudentCurriculumSelectionError("Enrollment not found.");
  if (enrollment.status !== "ACTIVE") throw new ShsStudentCurriculumSelectionError("Only active enrollments can have SSHS curriculum selections.");
  if (enrollment.academicYearStatus !== "ACTIVE") throw new ShsStudentCurriculumSelectionError("Enrollment is read-only because its academic year is not active.");
  if (enrollment.gradeLevel !== "11" && enrollment.gradeLevel !== "12") throw new ShsStudentCurriculumSelectionError("SSHS curriculum selection is limited to Grade 11 and 12 enrollments.");

  const eligible = await findEligibleShsOfferingsForEnrollment(enrollment.academicYearId, enrollment.gradeLevel, tx);
  const eligibleById = new Map(eligible.map((offering) => [offering.id, offering]));
  if (values.selections.some(({ subjectOfferingId }) => !eligibleById.has(subjectOfferingId))) {
    throw new ShsStudentCurriculumSelectionError("Selections must be active school-approved SSHS offerings for this enrollment's academic year and grade.");
  }
  for (const selection of values.selections) {
    const configuredTermIds = new Set(eligibleById.get(selection.subjectOfferingId)!.terms.map(({ academicTermId }) => academicTermId));
    if (!selection.academicTermIds.length || selection.academicTermIds.some((id) => !configuredTermIds.has(id))) {
      throw new ShsStudentCurriculumSelectionError("Each selected offering must include one or more of its configured Academic Terms.");
    }
  }

  const active = await findStudentSubjectEnrollments({ enrollmentId: enrollment.id, status: "ACTIVE" }, tx);
  const activeByOfferingId = new Map(active.map((row) => [row.subjectOfferingId, row]));
  const retainedIds: string[] = [];
  const newSelections = values.selections.flatMap((selection) => {
    const current = activeByOfferingId.get(selection.subjectOfferingId);
    const requestedTermIds = [...selection.academicTermIds].sort();
    const currentTermIds = current?.terms.map(({ academicTermId }) => academicTermId).sort();
    if (current && currentTermIds && requestedTermIds.length === currentTermIds.length && requestedTermIds.every((id, index) => id === currentTermIds[index])) {
      retainedIds.push(current.id);
      return [];
    }
    return [{ offering: eligibleById.get(selection.subjectOfferingId)!, academicTermIds: requestedTermIds }];
  });
  const replaced = await replaceChangedShsStudentSubjectEnrollments(enrollment.id, retainedIds, new Date(), tx);
  const created = await createShsStudentSubjectEnrollmentsFromSelections(enrollment.id, newSelections, actorId, tx);
  await createAuditLogs([
    ...replaced.map((row) => ({ userId: actorId, action: "UPDATE", module: "StudentSubjectEnrollment", recordId: row.id, recordName: row.subjectCode, description: "Replaced SSHS student subject enrollment." })),
    ...created.map((row) => ({ userId: actorId, action: "CREATE", module: "StudentSubjectEnrollment", recordId: row.id, recordName: row.subjectCode, description: "Selected school-approved SSHS subject offering and Academic Terms for enrollment." })),
  ], tx);
  return { created: created.length, replaced: replaced.length };
}
