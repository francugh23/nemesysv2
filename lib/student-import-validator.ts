export interface ImportValidationError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportValidationResult {
  valid: boolean;
  errors: ImportValidationError[];
}

const REQUIRED_FIELDS = ["lrn", "firstName", "lastName", "gender"];

const VALID_GENDERS = ["MALE", "FEMALE"];

export function validateStudentImport(
  rows: Record<string, unknown>[],
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

  const headers = Object.keys(rows[0]);

  for (const field of REQUIRED_FIELDS) {
    if (!headers.includes(field)) {
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

    for (const field of REQUIRED_FIELDS) {
      if (!row[field]) {
        errors.push({
          row: rowNumber,
          field,
          message: `${field} is required.`,
        });
      }
    }

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

    const gender = String(row.gender ?? "");

    if (gender && !VALID_GENDERS.includes(gender.toUpperCase())) {
      errors.push({
        row: rowNumber,
        field: "gender",
        message: `Invalid gender: ${gender}`,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}