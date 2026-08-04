"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import { getStudentImportTemplate } from "@/services/student.service";
import type { ImportTemplateActionResult } from "@/types/import-template";

export async function downloadStudentImportTemplateAction(): Promise<ImportTemplateActionResult> {
  try {
    await requirePermission(Permissions.STUDENTS);
  } catch {
    return { error: "Unauthorized." };
  }

  try {
    return { file: await getStudentImportTemplate() };
  } catch {
    return { error: "Unable to generate the student import template." };
  }
}
