export interface ImportValidationError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportValidationResult {
  valid: boolean;
  errors: ImportValidationError[];
}

export type ImportPreviewClassification =
  | "VALID"
  | "DUPLICATE_IN_FILE"
  | "EXISTING_ACTIVE"
  | "EXISTING_INACTIVE"
  | "EXISTING_ARCHIVED"
  | "EMAIL_COLLISION"
  | "INVALID";

export interface ImportPreviewOutcome {
  rowNumber: number;
  identity: string;
  name: string;
  classification: ImportPreviewClassification;
  issue: string | null;
}

export interface ImportServerPreview {
  totalRows: number;
  counts: Record<ImportPreviewClassification, number>;
  warningCount: number;
  canImport: boolean;
  page: number;
  pageCount: number;
  outcomes: ImportPreviewOutcome[];
}

export type ImportPreviewActionResult =
  | { preview: ImportServerPreview; error?: never }
  | { preview?: never; error: string };
