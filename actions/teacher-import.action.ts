"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import { normalizeTeacherImportRow } from "@/lib/teacher-import-normalizer";
import { confirmTeacherImportService, previewTeacherImportService } from "@/services/teacher.service";
import type { ActionResponse } from "@/types/action-response";
import type { ImportPreviewActionResult } from "@/types/import";

function normalizeImportValues(values: unknown) {
  if (!Array.isArray(values) || values.length === 0 || values.length > 500) return null;
  return values.map((value) => normalizeTeacherImportRow(value && typeof value === "object" ? value as Record<string, unknown> : {}));
}

export async function previewTeacherImportAction(values: unknown, page: number): Promise<ImportPreviewActionResult> {
  try {
    await requirePermission(Permissions.TEACHERS);
  } catch {
    return { error: "Unauthorized." };
  }
  const rows = normalizeImportValues(values);
  if (!rows || !Number.isInteger(page) || page < 1) return { error: "Invalid import data." };
  try {
    return { preview: await previewTeacherImportService(rows, page) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to preview the import." };
  }
}

export async function confirmTeacherImportAction(values: unknown): Promise<ActionResponse & { importedCount?: number }> {
  try {
    await requirePermission(Permissions.TEACHERS);
  } catch {
    return { error: "Unauthorized." };
  }
  const rows = normalizeImportValues(values);
  if (!rows) return { error: "Invalid import data." };
  try {
    const result = await confirmTeacherImportService(rows);
    return { success: `${result.importedCount} teacher${result.importedCount === 1 ? "" : "s"} imported successfully.`, importedCount: result.importedCount };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to import Teachers." };
  }
}
