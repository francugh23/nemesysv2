import * as XLSX from "xlsx";

export interface ParsedSpreadsheet {
  headers: string[];
  rows: Record<string, unknown>[];
}

export async function parseSpreadsheet(file: File): Promise<ParsedSpreadsheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer);
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return {
      headers: [],
      rows: [],
    };
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

  return {
    headers: Object.keys(rows[0] ?? {}),
    rows: rows.map((row) => ({ ...row })),
  };
}
