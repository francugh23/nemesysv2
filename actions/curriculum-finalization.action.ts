"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CurriculumFinalizationServiceError,
  finalizeCurriculumService,
} from "@/services/curriculum-finalization.service";
import type { ActionResponse } from "@/types/action-response";

export async function finalizeCurriculumAction(
  academicYearId: unknown,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.SUBJECTS);
  } catch {
    return { error: "Unauthorized." };
  }

  const parsed = z.string().min(1).safeParse(academicYearId);
  if (!parsed.success) return { error: "Invalid Academic Year." };

  try {
    await finalizeCurriculumService(parsed.data);
    return { success: "Curriculum finalized successfully." };
  } catch (error) {
    return {
      error: error instanceof CurriculumFinalizationServiceError
        ? error.message
        : "Curriculum could not be finalized.",
    };
  }
}
