"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CorrectStudentEnrollmentGradePlacementSchema,
  CorrectStudentEnrollmentPlacementSchema,
} from "@/schemas";
import {
  correctStudentEnrollmentGradePlacementService,
  getStudentEnrollmentGradeCorrectionPreviewService,
  StudentEnrollmentGradeCorrectionError,
} from "@/services/student-enrollment-grade-correction.service";
import {
  correctStudentEnrollmentPlacementService,
  getStudentEnrollmentCorrectionContextService,
  StudentEnrollmentCorrectionError,
} from "@/services/student-enrollment-correction.service";
import type { ActionResponse } from "@/types/action-response";

export async function getStudentEnrollmentCorrectionContextAction(enrollmentId: string) {
  await requirePermission(Permissions.STUDENT_CORRECTIONS);
  const validatedId = z.string().min(1).safeParse(enrollmentId);
  if (!validatedId.success) throw new StudentEnrollmentCorrectionError("Invalid Enrollment identity.");
  return getStudentEnrollmentCorrectionContextService(validatedId.data);
}

export async function correctStudentEnrollmentPlacementAction(
  enrollmentId: string,
  values: z.infer<typeof CorrectStudentEnrollmentPlacementSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.STUDENT_CORRECTIONS);
  } catch {
    return { error: "Unauthorized." };
  }
  const validatedId = z.string().min(1).safeParse(enrollmentId);
  const validatedFields = CorrectStudentEnrollmentPlacementSchema.safeParse(values);
  if (!validatedId.success || !validatedFields.success) return { error: "Invalid fields." };
  try {
    await correctStudentEnrollmentPlacementService(validatedId.data, validatedFields.data);
    return { success: "Enrollment placement corrected successfully." };
  } catch (error) {
    return {
      error: error instanceof StudentEnrollmentCorrectionError
        ? error.message
        : "Something went wrong.",
    };
  }
}

export async function getStudentEnrollmentGradeCorrectionPreviewAction(
  enrollmentId: string,
  destinationSectionId: string,
) {
  await requirePermission(Permissions.STUDENT_CORRECTIONS);
  const validated = z.object({
    enrollmentId: z.string().min(1),
    destinationSectionId: z.string().min(1),
  }).safeParse({ enrollmentId, destinationSectionId });
  if (!validated.success) throw new StudentEnrollmentGradeCorrectionError("Invalid grade-correction preview identity.");
  return getStudentEnrollmentGradeCorrectionPreviewService(
    validated.data.enrollmentId,
    validated.data.destinationSectionId,
  );
}

export async function correctStudentEnrollmentGradePlacementAction(
  enrollmentId: string,
  values: z.infer<typeof CorrectStudentEnrollmentGradePlacementSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.STUDENT_CORRECTIONS);
  } catch {
    return { error: "Unauthorized." };
  }
  const validatedId = z.string().min(1).safeParse(enrollmentId);
  const validatedFields = CorrectStudentEnrollmentGradePlacementSchema.safeParse(values);
  if (!validatedId.success || !validatedFields.success) return { error: "Invalid fields." };
  try {
    await correctStudentEnrollmentGradePlacementService(validatedId.data, validatedFields.data);
    return { success: "Enrollment grade-level correction recorded successfully." };
  } catch (error) {
    return {
      error: error instanceof StudentEnrollmentGradeCorrectionError
        ? error.message
        : "Something went wrong.",
    };
  }
}
