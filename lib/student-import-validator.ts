import { CreateStudentSchema } from "@/schemas";
import type {
  ImportValidationError,
  ImportValidationResult,
} from "@/types/import";
import { normalizeStudentImportHeader } from "./student-import-normalizer";

const REQUIRED_FIELDS = [
  "lrn",
  "firstName",
  "lastName",
  "gender",
  "barangay",
  "municipality",
  "province",
];

export function validateStudentImport(
  rows: Record<string, unknown>[],
  headers: string[] = Object.keys(rows[0] ?? {}),
): ImportValidationResult {
  const errors: ImportValidationError[] = [];

  if (rows.length === 0) {
    return {
      valid: false,
      errors: [
        {
          row: 0,
          message: "No records found.",
        },
      ],
    };
  }

  const normalizedHeaders = new Set(
    headers.map((header) => normalizeStudentImportHeader(header)).filter(Boolean),
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

  const lrns = new Set<string>();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;

    const lrn = String(row.lrn ?? "");

    if (lrn) {
      if (lrns.has(lrn)) {
        errors.push({
          row: rowNumber,
          field: "lrn",
          message: `Duplicate LRN: ${lrn}`,
        });
      }

      lrns.add(lrn);
    }

    const validatedRow = CreateStudentSchema.safeParse(row);

    if (!validatedRow.success) {
      for (const issue of validatedRow.error.issues) {
        errors.push({
          row: rowNumber,
          field: issue.path[0]?.toString(),
          message: issue.message,
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
