import * as XLSX from "xlsx";

import type { ExportCellValue, ExportColumn } from "@/types/export";

import { formatExportDateTime, neutralizeSpreadsheetFormula } from "./format";

export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function normalizeXlsxCell(value: ExportCellValue) {
  if (value instanceof Date) {
    return formatExportDateTime(value);
  }

  return typeof value === "string"
    ? neutralizeSpreadsheetFormula(value)
    : (value ?? "");
}

function sanitizeSheetName(value: string) {
  return value.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Export";
}

export function createXlsx(
  sheetName: string,
  columns: readonly ExportColumn[],
  rows: ExportCellValue[][],
) {
  const worksheet = XLSX.utils.aoa_to_sheet([
    columns.map((column) => column.header),
    ...rows.map((row) => row.map(normalizeXlsxCell)),
  ]);
  worksheet["!cols"] = columns.map((column) => ({
    wch: Math.min(Math.max(column.header.length + 2, 12), 40),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheetName));

  return XLSX.write(workbook, {
    type: "base64",
    bookType: "xlsx",
    compression: true,
  });
}
