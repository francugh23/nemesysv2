import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import { createShsStudentSubjectEnrollmentsFromOfferings, findEligibleShsOfferingsForEnrollment, findStudentSubjectEnrollments, lockActiveShsEnrollmentForCurriculumSelection, replaceDeselectedShsStudentSubjectEnrollments } from "@/repositories/student-subject-enrollment.repository";
import type { ShsStudentCurriculumSelectionInput, StudentSubjectEnrollmentRead } from "@/schemas";

export async function getStudentSubjectEnrollments(
  query: StudentSubjectEnrollmentRead,
) {
  await requirePermission(Permissions.ENROLLMENT);
  return findStudentSubjectEnrollments(query);
}

export class StudentSubjectEnrollmentServiceError extends Error {}

export async function getEligibleShsOfferingsForEnrollment(enrollmentId: string) {
  await requirePermission(Permissions.ENROLLMENT);
  return prisma.$transaction(async (tx) => {
    const enrollment = await lockActiveShsEnrollmentForCurriculumSelection(enrollmentId, tx);
    if (!enrollment || (enrollment.gradeLevel !== "11" && enrollment.gradeLevel !== "12")) return [];
    return findEligibleShsOfferingsForEnrollment(enrollment.academicYearId, enrollment.gradeLevel, tx);
  });
}

export async function selectShsStudentCurriculumService(values: ShsStudentCurriculumSelectionInput) {
  const session = await requirePermission(Permissions.ENROLLMENT);
  return prisma.$transaction(async (tx) => {
    const enrollment = await lockActiveShsEnrollmentForCurriculumSelection(values.enrollmentId, tx);
    if (!enrollment) throw new StudentSubjectEnrollmentServiceError("Enrollment not found.");
    if (enrollment.status !== "ACTIVE") throw new StudentSubjectEnrollmentServiceError("Only active enrollments can have SSHS curriculum selections.");
    if (enrollment.academicYearStatus !== "ACTIVE") throw new StudentSubjectEnrollmentServiceError("Enrollment is read-only because its academic year is not active.");
    if (enrollment.gradeLevel !== "11" && enrollment.gradeLevel !== "12") throw new StudentSubjectEnrollmentServiceError("SSHS curriculum selection is limited to Grade 11 and 12 enrollments.");
    const eligible = await findEligibleShsOfferingsForEnrollment(enrollment.academicYearId, enrollment.gradeLevel, tx);
    const eligibleById = new Map(eligible.map((offering) => [offering.id, offering]));
    if (values.subjectOfferingIds.some((id) => !eligibleById.has(id))) throw new StudentSubjectEnrollmentServiceError("Selections must be active school-approved SSHS offerings for this enrollment's academic year and grade.");
    const active = await findStudentSubjectEnrollments({ enrollmentId: enrollment.id, status: "ACTIVE" }, tx);
    const activeOfferingIds = new Set(active.map((row) => row.subjectOfferingId));
    const selectedIds = new Set(values.subjectOfferingIds);
    const newOfferings = values.subjectOfferingIds.filter((id) => !activeOfferingIds.has(id)).map((id) => eligibleById.get(id)!);
    const retainedIds = active.filter((row) => selectedIds.has(row.subjectOfferingId)).map((row) => row.subjectOfferingId);
    const replaced = await replaceDeselectedShsStudentSubjectEnrollments(enrollment.id, retainedIds, new Date(), tx);
    const created = await createShsStudentSubjectEnrollmentsFromOfferings(enrollment.id, newOfferings, session.user.id, tx);
    await createAuditLogs([
      ...replaced.map((row) => ({ userId: session.user.id, action: "UPDATE", module: "StudentSubjectEnrollment", recordId: row.id, recordName: row.subjectCode, description: "Replaced SSHS student subject enrollment." })),
      ...created.map((row) => ({ userId: session.user.id, action: "CREATE", module: "StudentSubjectEnrollment", recordId: row.id, recordName: row.subjectCode, description: "Selected school-approved SSHS subject offering for enrollment." })),
    ], tx);
    return { created: created.length, replaced: replaced.length };
  });
}
