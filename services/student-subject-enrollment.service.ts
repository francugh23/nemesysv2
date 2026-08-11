import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { findEligibleShsOfferingsForEnrollment, findStudentSubjectEnrollments, lockActiveShsEnrollmentForCurriculumSelection } from "@/repositories/student-subject-enrollment.repository";
import type { ShsStudentCurriculumSelectionInput, StudentSubjectEnrollmentRead } from "@/schemas";
import { selectShsStudentCurriculumInTransaction } from "@/services/student-subject-enrollment-selection.service";

export async function getStudentSubjectEnrollments(
  query: StudentSubjectEnrollmentRead,
) {
  await requirePermission(Permissions.ENROLLMENT);
  return findStudentSubjectEnrollments(query);
}

export async function getEligibleShsOfferingsForEnrollment(enrollmentId: string) {
  await requirePermission(Permissions.ENROLLMENT);
  return prisma.$transaction(async (tx) => {
    const enrollment = await lockActiveShsEnrollmentForCurriculumSelection(enrollmentId, tx);
    if (
      !enrollment ||
      enrollment.status !== "ACTIVE" ||
      enrollment.academicYearStatus !== "ACTIVE" ||
      (enrollment.gradeLevel !== "11" && enrollment.gradeLevel !== "12")
    ) return [];
    return findEligibleShsOfferingsForEnrollment(enrollment.academicYearId, enrollment.gradeLevel, tx);
  });
}

export async function selectShsStudentCurriculumService(values: ShsStudentCurriculumSelectionInput) {
  const session = await requirePermission(Permissions.ENROLLMENT);
  return prisma.$transaction((tx) => selectShsStudentCurriculumInTransaction(values, session.user.id, tx));
}
