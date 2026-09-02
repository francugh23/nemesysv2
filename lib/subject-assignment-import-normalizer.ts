import { subjectAssignmentImportTemplateDefinition } from "@/lib/import/definitions/subject-assignment-import-template.definition";
import { getImportFieldKeyByHeader } from "@/lib/import/template-definition";
import { canonicalEmployeeNumber } from "@/lib/teacher-identity";

function text(value: unknown) {
  return value === undefined || value === null ? "" : String(value).trim();
}

export function normalizeSubjectAssignmentImportHeader(header: string) {
  return getImportFieldKeyByHeader(subjectAssignmentImportTemplateDefinition, header);
}

export function normalizeSubjectAssignmentImportRow(row: Record<string, unknown>) {
  const mapped = Object.entries(row).reduce<Record<string, unknown>>((result, [header, value]) => {
    const field = normalizeSubjectAssignmentImportHeader(header);
    if (field) result[field] = value;
    return result;
  }, {});

  return {
    gradeLevel: text(mapped.gradeLevel),
    subjectCode: text(mapped.subjectCode).toUpperCase(),
    section: text(mapped.section),
    term: text(mapped.term),
    teacherEmployeeNumber: canonicalEmployeeNumber(text(mapped.teacherEmployeeNumber)),
  };
}

export function normalizedAssignmentImportText(value: string) {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

export function assignmentImportTermPosition(value: string) {
  const match = normalizedAssignmentImportText(value).match(/^(?:TERM )?(\d+)$/);
  return match ? Number(match[1]) : null;
}
