import * as XLSX from "xlsx";

import { neutralizeSpreadsheetFormula } from "@/lib/export/format";
import { XLSX_MIME_TYPE } from "@/lib/export/xlsx";
import type {
  ImportTemplateDefinition,
  ImportTemplateField,
  ImportTemplateFile,
  ImportTemplateWorksheet,
} from "@/types/import-template";

const INSTRUCTIONS_SHEET_NAME = "Instructions";

function sanitizeSheetName(value: string) {
  return value.replace(/[\\/?*\[\]:]/g, " ").trim().slice(0, 31) || "Template";
}

function createTemplateFileName(fileSlug: string) {
  const safeSlug = fileSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `nemesys-${safeSlug || "import"}-import-template.xlsx`;
}

function createImportWorksheet(definition: ImportTemplateWorksheet) {
  const headers = definition.fields.map((field) =>
    neutralizeSpreadsheetFormula(field.canonicalHeader),
  );
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  worksheet["!cols"] = headers.map((header) => ({
    wch: Math.min(Math.max(header.length + 2, 12), 40),
  }));

  return worksheet;
}

function createInstructionsWorksheet(fields: readonly ImportTemplateField[]) {
  const rows = [
    ["Field", "Required", "Accepted Values", "Format", "Notes"],
    ...fields.map((field) => [
      field.displayLabel,
      field.required ? "Yes" : "No",
      field.acceptedValues,
      field.format,
      field.notes,
    ]),
  ].map((row) => row.map(neutralizeSpreadsheetFormula));
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 12 },
    { wch: 28 },
    { wch: 24 },
    { wch: 48 },
  ];

  return worksheet;
}

export function generateImportTemplate(
  definition: ImportTemplateDefinition,
): ImportTemplateFile {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    createImportWorksheet(definition.importWorksheet),
    sanitizeSheetName(definition.importWorksheet.sheetName),
  );

  if (definition.includeInstructions) {
    XLSX.utils.book_append_sheet(
      workbook,
      createInstructionsWorksheet(definition.importWorksheet.fields),
      INSTRUCTIONS_SHEET_NAME,
    );
  }

  for (const worksheetDefinition of definition.additionalWorksheets ?? []) {
    XLSX.utils.book_append_sheet(
      workbook,
      createImportWorksheet(worksheetDefinition),
      sanitizeSheetName(worksheetDefinition.sheetName),
    );
  }

  return {
    fileName: createTemplateFileName(definition.fileSlug),
    mimeType: XLSX_MIME_TYPE,
    contentBase64: XLSX.write(workbook, {
      type: "base64",
      bookType: "xlsx",
      compression: true,
    }),
  };
}
