"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  AssignmentMatrixQuerySchema,
  AssignmentMatrixMutationSchema,
  CreateSubjectAssignmentSchema,
  SubjectAssignmentExportSchema,
  SubjectAssignmentImportPreviewSchema,
  SubjectAssignmentImportConfirmSchema,
  SubjectAssignmentHistoryFilterOptionsQuerySchema,
  SubjectAssignmentHistoryOptionsQuerySchema,
  SubjectAssignmentHistoryQuerySchema,
  UpdateSubjectAssignmentSchema,
} from "@/schemas";
import {
  archiveSubjectAssignmentService,
  mutateAssignmentMatrix,
  createSubjectAssignmentService,
  getSubjectAssignmentOptions,
  getAssignmentMatrix,
  getSubjectAssignmentHistory,
  getSubjectAssignmentHistoryFilterOptions,
  getSubjectAssignmentHistoryOptions,
  getSubjectAssignments,
  getSubjectAssignmentImportTemplate,
  previewSubjectAssignmentImport,
  confirmSubjectAssignmentImport,
  exportSubjectAssignments,
  updateSubjectAssignmentService,
} from "@/services/subject-assignment.service";
import { ActionResponse } from "@/types/action-response";
import type { ExportActionResult } from "@/types/export";
import type { ImportTemplateActionResult } from "@/types/import-template";

export async function getSubjectAssignmentsAction() {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);

  return await getSubjectAssignments();
}

export async function getSubjectAssignmentHistoryAction(query: unknown) {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  return getSubjectAssignmentHistory(SubjectAssignmentHistoryQuerySchema.parse(query));
}

export async function getSubjectAssignmentHistoryFilterOptionsAction(query: unknown) {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  return getSubjectAssignmentHistoryFilterOptions(
    SubjectAssignmentHistoryFilterOptionsQuerySchema.parse(query),
  );
}

export async function getSubjectAssignmentHistoryOptionsAction(query: unknown) {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  return getSubjectAssignmentHistoryOptions(
    SubjectAssignmentHistoryOptionsQuerySchema.parse(query),
  );
}

export async function getSubjectAssignmentOptionsAction() {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);

  return await getSubjectAssignmentOptions();
}

export async function getSubjectAssignmentImportTemplateAction(): Promise<ImportTemplateActionResult> {
  try {
    await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
    return { file: await getSubjectAssignmentImportTemplate() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to generate the teaching assignment template." };
  }
}

export async function previewSubjectAssignmentImportAction(rows: unknown, gradeLevel: unknown, page: unknown) {
  try {
    await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  } catch {
    return { error: "Unauthorized." };
  }
  const validated = SubjectAssignmentImportPreviewSchema.safeParse({ rows, gradeLevel, page });
  if (!validated.success) return { error: "Invalid teaching assignment import data." };
  try {
    return { preview: await previewSubjectAssignmentImport(validated.data) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to preview teaching assignments." };
  }
}

export async function confirmSubjectAssignmentImportAction(rows: unknown, gradeLevel: unknown, previewFingerprint: unknown) {
  try {
    await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  } catch {
    return { error: "Unauthorized." };
  }
  const validated = SubjectAssignmentImportConfirmSchema.safeParse({ rows, gradeLevel, previewFingerprint });
  if (!validated.success) return { error: "Invalid teaching assignment confirmation request." };
  try {
    return { result: await confirmSubjectAssignmentImport(validated.data) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to confirm teaching assignments." };
  }
}

export async function exportSubjectAssignmentsAction(gradeLevel: unknown): Promise<ExportActionResult> {
  try {
    await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  } catch {
    return { error: "Unauthorized." };
  }
  const validated = SubjectAssignmentExportSchema.safeParse({ gradeLevel });
  if (!validated.success) return { error: "Invalid teaching assignment export request." };
  try {
    return { file: await exportSubjectAssignments(validated.data.gradeLevel) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to export teaching assignments." };
  }
}

export async function getAssignmentMatrixAction(query: unknown) {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  const validated = AssignmentMatrixQuerySchema.safeParse(query);
  if (!validated.success) throw new Error("Invalid assignment matrix query.");
  return getAssignmentMatrix(validated.data);
}

export async function mutateAssignmentMatrixAction(values: unknown): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  } catch {
    return { error: "Unauthorized." };
  }

  const validated = AssignmentMatrixMutationSchema.safeParse(values);
  if (!validated.success) return { error: "Invalid matrix assignment request." };

  try {
    const result = await mutateAssignmentMatrix(validated.data);
    return { success: `${result.changedCount} teaching assignment scope${result.changedCount === 1 ? "" : "s"} updated.` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function createSubjectAssignmentAction(
  values: z.infer<typeof CreateSubjectAssignmentSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedFields = CreateSubjectAssignmentSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await createSubjectAssignmentService(validatedFields.data);

    return {
      success: "Subject assignment created successfully.",
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      };
    }

    return {
      error: "Something went wrong.",
    };
  }
}

export async function updateSubjectAssignmentAction(
  id: string,
  values: z.infer<typeof UpdateSubjectAssignmentSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedId = z.string().min(1).safeParse(id);
  const validatedFields = UpdateSubjectAssignmentSchema.safeParse(values);

  if (!validatedId.success || !validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await updateSubjectAssignmentService(validatedId.data, validatedFields.data);

    return {
      success: "Subject assignment updated successfully.",
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      };
    }

    return {
      error: "Something went wrong.",
    };
  }
}

export async function archiveSubjectAssignmentAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedId = z.string().min(1).safeParse(id);

  if (!validatedId.success) {
    return {
      error: "Invalid subject assignment.",
    };
  }

  try {
    await archiveSubjectAssignmentService(validatedId.data);

    return {
      success: "Subject assignment archived successfully.",
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      };
    }

    return {
      error: "Something went wrong.",
    };
  }
}
