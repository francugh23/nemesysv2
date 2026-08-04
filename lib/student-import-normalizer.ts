import * as XLSX from "xlsx";

import { studentImportTemplateDefinition } from "@/lib/import/definitions/student-import-template.definition";
import { getImportFieldKeyByHeader } from "@/lib/import/template-definition";

export function normalizeStudentImportHeader(header: string) {
  return getImportFieldKeyByHeader(studentImportTemplateDefinition, header);
}

function normalizeString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value).trim();
}

function normalizeDateOfBirth(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    const parsedDate = XLSX.SSF.parse_date_code(value);

    if (!parsedDate) {
      return value;
    }

    return new Date(parsedDate.y, parsedDate.m - 1, parsedDate.d);
  }

  if (typeof value === "string") {
    const parsedDate = new Date(value);

    return Number.isNaN(parsedDate.getTime()) ? value : parsedDate;
  }

  return value;
}

export function normalizeStudentImportRow(row: Record<string, unknown>) {
  const mappedRow = Object.entries(row).reduce<Record<string, unknown>>(
    (normalizedRow, [header, value]) => {
      const field = normalizeStudentImportHeader(header);

      if (field) {
        normalizedRow[field] = value;
      }

      return normalizedRow;
    },
    {},
  );

  return {
    lrn: normalizeString(mappedRow.lrn),
    firstName: normalizeString(mappedRow.firstName),
    middleName: normalizeString(mappedRow.middleName),
    lastName: normalizeString(mappedRow.lastName),
    gender: normalizeString(mappedRow.gender)?.toUpperCase(),
    dateOfBirth: normalizeDateOfBirth(mappedRow.dateOfBirth),
    purok: normalizeString(mappedRow.purok),
    barangay: normalizeString(mappedRow.barangay),
    municipality: normalizeString(mappedRow.municipality),
    province: normalizeString(mappedRow.province),
    zipCode: normalizeString(mappedRow.zipCode),
    fatherName: normalizeString(mappedRow.fatherName),
    fatherContact: normalizeString(mappedRow.fatherContact),
    motherName: normalizeString(mappedRow.motherName),
    motherContact: normalizeString(mappedRow.motherContact),
    guardianName: normalizeString(mappedRow.guardianName),
    guardianContact: normalizeString(mappedRow.guardianContact),
  };
}
