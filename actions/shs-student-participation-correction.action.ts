"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import { CorrectShsStudentParticipationSchema } from "@/schemas";
import {
  correctShsStudentParticipationService,
  ShsStudentParticipationCorrectionError,
} from "@/services/shs-student-participation-correction.service";
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
