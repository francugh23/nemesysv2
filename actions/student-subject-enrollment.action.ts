"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  DropStudentSubjectEnrollmentSchema,
  ShsCurrentTermProgressionSchema,
  StudentSubjectEnrollmentReadSchema,
  type StudentSubjectEnrollmentReadInput,
} from "@/schemas";
import {
  dropShsStudentSubjectEnrollmentService,
  getShsCurrentTermProgressionContext,
  getStudentSubjectEnrollments,
  progressShsCurrentTermService,
} from "@/services/student-subject-enrollment.service";

export async function getStudentSubjectEnrollmentsAction(query: StudentSubjectEnrollmentReadInput) {
  await requirePermission(Permissions.ENROLLMENT);
  return getStudentSubjectEnrollments(StudentSubjectEnrollmentReadSchema.parse(query));
}

export async function getShsCurrentTermProgressionContextAction(enrollmentId: string) {
  await requirePermission(Permissions.ENROLLMENT);
  return getShsCurrentTermProgressionContext(enrollmentId);
}

export async function progressShsCurrentTermAction(values: unknown) {
  try {
    await requirePermission(Permissions.ENROLLMENT);
    const parsed = ShsCurrentTermProgressionSchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid fields." };
    return { success: "Current-Term SHS participation saved.", data: await progressShsCurrentTermService(parsed.data) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function dropShsStudentSubjectEnrollmentAction(values: unknown) {
  try {
    await requirePermission(Permissions.ENROLLMENT);
    const parsed = DropStudentSubjectEnrollmentSchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid fields." };
    return { success: "SHS subject participation dropped.", data: await dropShsStudentSubjectEnrollmentService(parsed.data) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
