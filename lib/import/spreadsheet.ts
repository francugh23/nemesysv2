import * as XLSX from "xlsx";

export interface ParsedSpreadsheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface SpreadsheetParseLimits {
  maxFileSizeBytes?: number;
  maxRows?: number;
}

export async function parseSpreadsheet(
  file: File,
  limits: SpreadsheetParseLimits = {},
): Promise<ParsedSpreadsheet> {
  if (limits.maxFileSizeBytes && file.size > limits.maxFileSizeBytes) {
    throw new Error("The selected file exceeds the maximum file size.");
  }

  if (!/\.(xlsx|csv)$/i.test(file.name)) {
    throw new Error("Only XLSX and CSV files are supported.");
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheetName = workbook.SheetNames.find(
    (name) => name.trim().toLowerCase() !== "instructions",
  );

  if (!sheetName) {
    return {
      headers: [],
      rows: [],
    };
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

  if (limits.maxRows && rows.length > limits.maxRows) {
    throw new Error(`The selected file exceeds the ${limits.maxRows}-row limit.`);
  }

  return {
    headers: Object.keys(rows[0] ?? {}),
    rows: rows.map((row) => ({ ...row })),
  };
}
