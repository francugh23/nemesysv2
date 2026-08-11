"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  StudentSubjectEnrollmentReadSchema,
  type StudentSubjectEnrollmentReadInput,
} from "@/schemas";
import { getStudentSubjectEnrollments } from "@/services/student-subject-enrollment.service";

export async function getStudentSubjectEnrollmentsAction(
  query: StudentSubjectEnrollmentReadInput,
) {
  await requirePermission(Permissions.ENROLLMENT);
  return getStudentSubjectEnrollments(StudentSubjectEnrollmentReadSchema.parse(query));
}
