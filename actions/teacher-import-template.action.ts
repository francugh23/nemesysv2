"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import { getTeacherImportTemplate } from "@/services/teacher.service";
import type { ImportTemplateActionResult } from "@/types/import-template";

export async function downloadTeacherImportTemplateAction(): Promise<ImportTemplateActionResult> {
  try {
    await requirePermission(Permissions.TEACHERS);
    return { file: await getTeacherImportTemplate() };
  } catch {
    return { error: "Unable to generate the teacher import template." };
  }
}
