export interface ImportValidationError {
  row: number;
  field?: string;
  message: string;
}

export interface ImportValidationResult {
  valid: boolean;
  errors: ImportValidationError[];
}
