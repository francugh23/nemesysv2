"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import { getSubjectImportTemplate } from "@/services/subject.service";
import type { ImportTemplateActionResult } from "@/types/import-template";

export async function downloadSubjectImportTemplateAction(): Promise<ImportTemplateActionResult> {
  try {
    await requirePermission(Permissions.SUBJECTS);
  } catch {
    return { error: "Unauthorized." };
  }

  try {
    return { file: await getSubjectImportTemplate() };
  } catch {
    return { error: "Unable to generate the subject import template." };
  }
}
