"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CommitCurriculumAdoptionSchema,
  CurriculumAdoptionOptionsSchema,
  CurriculumAdoptionPreviewSchema,
} from "@/schemas";
import {
  CurriculumAdoptionServiceError,
  commitCurriculumAdoptionService,
  getCurriculumAdoptionOptionsService,
  previewCurriculumAdoptionService,
} from "@/services/curriculum-adoption.service";

function adoptionError(error: unknown, fallback: string) {
  return { error: error instanceof CurriculumAdoptionServiceError ? error.message : fallback };
}

export async function previewCurriculumAdoptionAction(values: unknown) {
  try {
    await requirePermission(Permissions.SUBJECTS);
  } catch {
    return { error: "Unauthorized." };
  }
  const parsed = CurriculumAdoptionPreviewSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid curriculum adoption preview." };
  try {
    return { data: await previewCurriculumAdoptionService(parsed.data) };
  } catch (error) {
    return adoptionError(error, "Curriculum adoption preview failed.");
  }
}

export async function getCurriculumAdoptionOptionsAction(values: unknown) {
  try {
    await requirePermission(Permissions.SUBJECTS);
  } catch {
    return { error: "Unauthorized." };
  }
  const parsed = CurriculumAdoptionOptionsSchema.safeParse(values);
  if (!parsed.success) return { error: "Invalid curriculum adoption options request." };
  try {
    return {
      data: await getCurriculumAdoptionOptionsService(
        parsed.data.destinationAcademicYearId,
      ),
    };
  } catch (error) {
    return adoptionError(error, "Unable to load curriculum adoption options.");
  }
}

export async function commitCurriculumAdoptionAction(values: unknown) {
  try {
    await requirePermission(Permissions.SUBJECTS);
  } catch {
    return { error: "Unauthorized." };
  }
  const parsed = CommitCurriculumAdoptionSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid curriculum adoption request." };
  try {
    return {
      success: "Curriculum adopted successfully.",
      data: await commitCurriculumAdoptionService(parsed.data),
    };
  } catch (error) {
    return adoptionError(error, "Curriculum adoption failed.");
  }
}
