import type { ExportCellValue, ExportColumn } from "@/types/export";

import { formatExportDateTime, neutralizeSpreadsheetFormula } from "./format";

export const CSV_MIME_TYPE = "text/csv;charset=utf-8";

function serializeCsvCell(value: ExportCellValue) {
  const serialized =
    value instanceof Date
      ? formatExportDateTime(value)
      : value === null || value === undefined
        ? ""
        : typeof value === "string"
          ? neutralizeSpreadsheetFormula(value)
          : String(value);
  const escaped = serialized.replace(/"/g, '""');

  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function createCsv(
  columns: readonly ExportColumn[],
  rows: ExportCellValue[][],
) {
  const lines = [
    columns.map((column) => serializeCsvCell(column.header)).join(","),
    ...rows.map((row) => row.map(serializeCsvCell).join(",")),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}
