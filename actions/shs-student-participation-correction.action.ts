"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import { CorrectShsStudentParticipationSchema } from "@/schemas";
import {
  correctShsStudentParticipationService,
  ShsStudentParticipationCorrectionError,
} from "@/services/shs-student-participation-correction.service";
import {
  getShsStudentParticipationCorrectionContextService,
  getShsStudentParticipationCorrectionHistoryService,
  getShsStudentParticipationCorrectionPreviewService,
} from "@/services/shs-student-participation-correction-preview.service";
import type { ActionResponse } from "@/types/action-response";

export async function correctShsStudentParticipationAction(
  enrollmentId: string,
  values: z.infer<typeof CorrectShsStudentParticipationSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.STUDENT_CORRECTIONS);
  } catch {
    return { error: "Unauthorized." };
  }
  const validatedId = z.string().trim().min(1).safeParse(enrollmentId);
  const validatedFields = CorrectShsStudentParticipationSchema.safeParse(values);
  if (!validatedId.success || !validatedFields.success) return { error: "Invalid fields." };
  try {
    await correctShsStudentParticipationService(validatedId.data, validatedFields.data);
    return { success: "SHS student participation corrected successfully." };
  } catch (error) {
    return { error: error instanceof ShsStudentParticipationCorrectionError ? error.message : "Something went wrong." };
  }
}

export async function getShsStudentParticipationCorrectionContextAction(enrollmentId: string) {
  await requirePermission(Permissions.STUDENT_CORRECTIONS);
  const parsed = z.string().trim().min(1).safeParse(enrollmentId);
  if (!parsed.success) throw new ShsStudentParticipationCorrectionError("Invalid Enrollment identity.");
  return getShsStudentParticipationCorrectionContextService(parsed.data);
}

export async function getShsStudentParticipationCorrectionPreviewAction(enrollmentId: string, sourceStudentSubjectEnrollmentId: string, sourceAcademicTermId: string) {
  await requirePermission(Permissions.STUDENT_CORRECTIONS);
  const parsed = z.object({ enrollmentId: z.string().trim().min(1), sourceStudentSubjectEnrollmentId: z.string().trim().min(1), sourceAcademicTermId: z.string().trim().min(1) }).safeParse({ enrollmentId, sourceStudentSubjectEnrollmentId, sourceAcademicTermId });
  if (!parsed.success) throw new ShsStudentParticipationCorrectionError("Invalid SHS participation correction preview identity.");
  return getShsStudentParticipationCorrectionPreviewService(parsed.data.enrollmentId, parsed.data.sourceStudentSubjectEnrollmentId, parsed.data.sourceAcademicTermId);
}

export async function getShsStudentParticipationCorrectionHistoryAction(enrollmentId: string) {
  await requirePermission(Permissions.STUDENT_CORRECTIONS);
  const parsed = z.string().trim().min(1).safeParse(enrollmentId);
  if (!parsed.success) throw new ShsStudentParticipationCorrectionError("Invalid Enrollment identity.");
  return getShsStudentParticipationCorrectionHistoryService(parsed.data);
}
