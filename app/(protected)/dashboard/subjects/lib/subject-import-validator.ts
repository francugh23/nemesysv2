import { getSubjectIdentityKey, normalizeSubjectIdentity } from "@/lib/subject-identity";
import { CreateSubjectSchema } from "@/schemas";
import type { ImportValidationError, ImportValidationResult } from "@/types/import";
import { subjectImportTemplateDefinition } from "@/lib/import/definitions/subject-import-template.definition";
import { getRequiredImportFieldKeys } from "@/lib/import/template-definition";

import { normalizeSubjectImportHeader } from "./subject-import-normalizer";

const REQUIRED_FIELDS = getRequiredImportFieldKeys(subjectImportTemplateDefinition);

export function validateSubjectImport(
  rows: Record<string, unknown>[],
  headers: string[],
): ImportValidationResult {
  const errors: ImportValidationError[] = [];

  if (rows.length === 0) {
    return {
      valid: false,
      errors: [{ row: 0, message: "No records found." }],
    };
  }

  const normalizedHeaders = new Set(
    headers.map((header) => normalizeSubjectImportHeader(header)).filter(Boolean),
  );

  for (const field of REQUIRED_FIELDS) {
    if (!normalizedHeaders.has(field)) {
      errors.push({
        row: 0,
        field,
        message: `Missing required column: ${field}`,
      });
    }
  }

  const identities = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const validatedRow = CreateSubjectSchema.safeParse(row);

    if (!validatedRow.success) {
      for (const issue of validatedRow.error.issues) {
        errors.push({
          row: rowNumber,
          field: issue.path[0]?.toString(),
          message: issue.message,
        });
      }

      return;
    }

    const identity = normalizeSubjectIdentity(validatedRow.data);
    const identityKey = getSubjectIdentityKey(identity);

    if (identities.has(identityKey)) {
      errors.push({
        row: rowNumber,
        field: "code",
        message: "Duplicate Subject identity in import file.",
      });
    }

    identities.add(identityKey);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
