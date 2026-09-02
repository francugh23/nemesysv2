import { teacherImportTemplateDefinition } from "@/lib/import/definitions/teacher-import-template.definition";
import { getRequiredImportFieldKeys } from "@/lib/import/template-definition";
import { CreateTeacherSchema } from "@/schemas";
import type { ImportValidationError, ImportValidationResult } from "@/types/import";

import { normalizeTeacherImportHeader } from "./teacher-import-normalizer";

const REQUIRED_FIELDS = getRequiredImportFieldKeys(teacherImportTemplateDefinition);

export function validateTeacherImport(rows: Record<string, unknown>[], headers: string[]): ImportValidationResult {
  const errors: ImportValidationError[] = [];
  if (!rows.length) return { valid: false, errors: [{ row: 0, message: "No records found." }] };
  const normalizedHeaders = new Set(headers.map(normalizeTeacherImportHeader).filter(Boolean));
  for (const field of REQUIRED_FIELDS) {
    if (!normalizedHeaders.has(field)) errors.push({ row: 0, field, message: `Missing required column: ${field}` });
  }
  const employeeNumbers = new Set<string>();
  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const parsed = CreateTeacherSchema.safeParse(row);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => errors.push({ row: rowNumber, field: issue.path[0]?.toString(), message: issue.message }));
      return;
    }
    if (employeeNumbers.has(parsed.data.employeeNumber)) errors.push({ row: rowNumber, field: "employeeNumber", message: "Duplicate employee number in import file." });
    employeeNumbers.add(parsed.data.employeeNumber);
  });
  return { valid: errors.length === 0, errors };
}
