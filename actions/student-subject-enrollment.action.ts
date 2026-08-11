"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  StudentSubjectEnrollmentReadSchema,
  ShsStudentCurriculumSelectionSchema,
  type StudentSubjectEnrollmentReadInput,
} from "@/schemas";
import { getEligibleShsOfferingsForEnrollment, getStudentSubjectEnrollments, selectShsStudentCurriculumService } from "@/services/student-subject-enrollment.service";

export async function getStudentSubjectEnrollmentsAction(
  query: StudentSubjectEnrollmentReadInput,
) {
  await requirePermission(Permissions.ENROLLMENT);
  return getStudentSubjectEnrollments(StudentSubjectEnrollmentReadSchema.parse(query));
}

export async function getEligibleShsOfferingsForEnrollmentAction(enrollmentId: string) { await requirePermission(Permissions.ENROLLMENT); return getEligibleShsOfferingsForEnrollment(enrollmentId); }
export async function selectShsStudentCurriculumAction(values: unknown) { try { await requirePermission(Permissions.ENROLLMENT); } catch { return { error: "Unauthorized." }; } const parsed = ShsStudentCurriculumSelectionSchema.safeParse(values); try { return parsed.success ? { success: "SSHS curriculum selection saved.", data: await selectShsStudentCurriculumService(parsed.data) } : { error: "Invalid fields." }; } catch (error) { return { error: error instanceof Error ? error.message : "Something went wrong." }; } }
