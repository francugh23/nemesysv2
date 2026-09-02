import { teacherImportTemplateDefinition } from "@/lib/import/definitions/teacher-import-template.definition";
import { getImportFieldKeyByHeader } from "@/lib/import/template-definition";
import { canonicalEmail, canonicalEmployeeNumber } from "@/lib/teacher-identity";

export function normalizeTeacherImportHeader(header: string) {
  return getImportFieldKeyByHeader(teacherImportTemplateDefinition, header);
}

function stringValue(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function normalizeTeacherImportRow(row: Record<string, unknown>) {
  const mapped = Object.entries(row).reduce<Record<string, unknown>>((result, [header, value]) => {
    const field = normalizeTeacherImportHeader(header);
    if (field) result[field] = value;
    return result;
  }, {});
  const optional = (value: unknown) => stringValue(value) || undefined;

  return {
    employeeNumber: canonicalEmployeeNumber(stringValue(mapped.employeeNumber)),
    firstName: stringValue(mapped.firstName),
    middleName: optional(mapped.middleName),
    lastName: stringValue(mapped.lastName),
    gender: stringValue(mapped.gender).toUpperCase(),
    email: canonicalEmail(optional(mapped.email)) ?? undefined,
    degree: optional(mapped.degree),
    major: optional(mapped.major),
  };
}
