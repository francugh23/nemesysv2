import { Permissions, requirePermission } from "@/lib/authorization";
import { findStudentSubjectEnrollments } from "@/repositories/student-subject-enrollment.repository";
import type { StudentSubjectEnrollmentRead } from "@/schemas";

export async function getStudentSubjectEnrollments(
  query: StudentSubjectEnrollmentRead,
) {
  await requirePermission(Permissions.ENROLLMENT);
  return findStudentSubjectEnrollments(query);
}
