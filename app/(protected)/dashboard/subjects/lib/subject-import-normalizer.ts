import { normalizeSubjectIdentity } from "@/lib/subject-identity";

const HEADER_ALIASES: Record<string, string> = {
  code: "code",
  subjectcode: "code",
  description: "description",
  subjectdescription: "description",
  gradelevel: "gradeLevel",
  grade: "gradeLevel",
  trackstrand: "trackStrand",
  track: "trackStrand",
  strand: "trackStrand",
  semester: "semester",
};

export function normalizeSubjectImportHeader(header: string) {
  return HEADER_ALIASES[header.trim().toLowerCase().replace(/[^a-z0-9]/g, "")];
}

function normalizeString(value: unknown) {
  if (value === undefined || value === null) return undefined;

  const normalized = String(value).trim();
  return normalized || undefined;
}

function normalizeGradeLevel(value: unknown) {
  const normalized = normalizeString(value)?.toUpperCase();
  const match = normalized?.match(/^(?:GRADE\s*)?(7|8|9|10|11|12)$/);

  return match?.[1] ?? normalized;
}

function normalizeSemester(value: unknown) {
  const normalized = normalizeString(value)?.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (["1", "1ST", "FIRST", "FIRSTSEMESTER"].includes(normalized ?? "")) {
    return "FIRST";
  }

  if (["2", "2ND", "SECOND", "SECONDSEMESTER"].includes(normalized ?? "")) {
    return "SECOND";
  }

  return normalized;
}

export function normalizeSubjectImportRow(row: Record<string, unknown>) {
  const mappedRow = Object.entries(row).reduce<Record<string, unknown>>(
    (normalizedRow, [header, value]) => {
      const field = normalizeSubjectImportHeader(header);

      if (field) {
        normalizedRow[field] = value;
      }

      return normalizedRow;
    },
    {},
  );
  const identity = normalizeSubjectIdentity({
    code: normalizeString(mappedRow.code) ?? "",
    gradeLevel: normalizeGradeLevel(mappedRow.gradeLevel) ?? "",
    trackStrand: normalizeString(mappedRow.trackStrand),
  });

  return {
    code: identity.code || undefined,
    description: normalizeString(mappedRow.description),
    gradeLevel: identity.gradeLevel || undefined,
    trackStrand: identity.trackStrand ?? undefined,
    semester: normalizeSemester(mappedRow.semester),
  };
}
