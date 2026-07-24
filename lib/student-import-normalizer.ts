import * as XLSX from "xlsx";

const HEADER_ALIASES: Record<string, string> = {
  lrn: "lrn",
  learnerreferencenumber: "lrn",
  firstname: "firstName",
  middlename: "middleName",
  lastname: "lastName",
  gender: "gender",
  dateofbirth: "dateOfBirth",
  purok: "purok",
  barangay: "barangay",
  municipality: "municipality",
  province: "province",
  zipcode: "zipCode",
  fathername: "fatherName",
  fathercontact: "fatherContact",
  mothername: "motherName",
  mothercontact: "motherContact",
  guardianname: "guardianName",
  guardiancontact: "guardianContact",
};

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
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
      const field = HEADER_ALIASES[normalizeHeader(header)];

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
