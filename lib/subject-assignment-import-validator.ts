import { z } from "zod";

import { subjectAssignmentImportTemplateDefinition } from "@/lib/import/definitions/subject-assignment-import-template.definition";
import { getRequiredImportFieldKeys } from "@/lib/import/template-definition";
import { normalizeSubjectAssignmentImportHeader } from "@/lib/subject-assignment-import-normalizer";
import type { ImportValidationError, ImportValidationResult } from "@/types/import";

export const SubjectAssignmentImportRowSchema = z.object({
  gradeLevel: z.enum(["7", "8", "9", "10", "11", "12"]),
  subjectCode: z.string().min(1, "Subject Code is required."),
  section: z.string().min(1, "Section is required."),
  term: z.string().min(1, "Term is required."),
  teacherEmployeeNumber: z.string().min(1, "Teacher Employee Number is required."),
});

export function validateSubjectAssignmentImport(
  rows: Record<string, unknown>[],
  headers: string[],
): ImportValidationResult {
  const required = new Set(getRequiredImportFieldKeys(subjectAssignmentImportTemplateDefinition));
  const present = new Set(headers.map(normalizeSubjectAssignmentImportHeader).filter(Boolean));
  const errors: ImportValidationError[] = [...required]
    .filter((field) => !present.has(field))
    .map((field) => ({ row: 1, field, message: "Required column is missing." }));

  rows.forEach((row, index) => {
    const result = SubjectAssignmentImportRowSchema.safeParse(row);
    if (!result.success) {
      errors.push(...result.error.issues.map((issue) => ({
        row: index + 2,
        field: issue.path[0] ? String(issue.path[0]) : undefined,
        message: issue.message,
      })));
    }
  });

  return { valid: errors.length === 0, errors };
}
