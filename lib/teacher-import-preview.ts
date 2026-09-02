import { canonicalEmail } from "@/lib/teacher-identity";
import { normalizeTeacherImportRow } from "@/lib/teacher-import-normalizer";
import { CreateTeacherSchema } from "@/schemas";
import type { ImportPreviewClassification, ImportServerPreview } from "@/types/import";

export const TEACHER_IMPORT_PREVIEW_PAGE_SIZE = 25;

export interface TeacherImportExistingRecord {
  employeeNumber: string;
  email: string | null;
  status: "ACTIVE" | "INACTIVE";
  deletedAt: Date | null;
}

const classifications: ImportPreviewClassification[] = ["VALID", "DUPLICATE_IN_FILE", "EXISTING_ACTIVE", "EXISTING_INACTIVE", "EXISTING_ARCHIVED", "EMAIL_COLLISION", "INVALID"];

function emptyCounts(): Record<ImportPreviewClassification, number> {
  return Object.fromEntries(classifications.map((classification) => [classification, 0])) as Record<ImportPreviewClassification, number>;
}

export function classifyTeacherImportRows(
  rows: Record<string, unknown>[],
  existingTeachers: TeacherImportExistingRecord[],
  page: number,
): ImportServerPreview {
  const normalizedRows = rows.map(normalizeTeacherImportRow);
  const parsedRows = normalizedRows.map((row) => CreateTeacherSchema.safeParse(row));
  const employeeCounts = new Map<string, number>();
  const emailCounts = new Map<string, number>();
  parsedRows.forEach((parsed) => {
    if (!parsed.success) return;
    employeeCounts.set(parsed.data.employeeNumber, (employeeCounts.get(parsed.data.employeeNumber) ?? 0) + 1);
    const email = canonicalEmail(parsed.data.email);
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  });
  const teachersByEmployeeNumber = new Map(existingTeachers.map((teacher) => [teacher.employeeNumber, teacher]));
  const teachersByEmail = new Map<string, TeacherImportExistingRecord[]>();
  existingTeachers.forEach((teacher) => {
    const email = canonicalEmail(teacher.email ?? undefined);
    if (email) teachersByEmail.set(email, [...(teachersByEmail.get(email) ?? []), teacher]);
  });
  const counts = emptyCounts();
  const outcomes = parsedRows.map((parsed, index) => {
    const raw = normalizedRows[index];
    let classification: ImportPreviewClassification = "VALID";
    let issue: string | null = null;
    if (!parsed.success) {
      classification = "INVALID";
      issue = parsed.error.issues[0]?.message ?? "Invalid Teacher data.";
    } else if ((employeeCounts.get(parsed.data.employeeNumber) ?? 0) > 1) {
      classification = "DUPLICATE_IN_FILE";
      issue = "Employee number is duplicated in this import file.";
    } else {
      const existing = teachersByEmployeeNumber.get(parsed.data.employeeNumber);
      const email = canonicalEmail(parsed.data.email);
      if (existing) {
        classification = existing.deletedAt ? "EXISTING_ARCHIVED" : existing.status === "INACTIVE" ? "EXISTING_INACTIVE" : "EXISTING_ACTIVE";
        issue = "Employee number already belongs to an existing Teacher.";
      } else if (email && (emailCounts.get(email) ?? 0) > 1) {
        classification = "EMAIL_COLLISION";
        issue = "Email is used by another employee number in this import file.";
      } else if (email && teachersByEmail.get(email)?.some((teacher) => teacher.employeeNumber !== parsed.data.employeeNumber)) {
        classification = "EMAIL_COLLISION";
        issue = "Email already belongs to another Teacher.";
      }
    }
    counts[classification] += 1;
    return { rowNumber: index + 2, identity: raw.employeeNumber || "", name: [raw.lastName, raw.firstName].filter(Boolean).join(", "), classification, issue };
  });
  const pageCount = Math.max(1, Math.ceil(outcomes.length / TEACHER_IMPORT_PREVIEW_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  return {
    totalRows: outcomes.length,
    counts,
    warningCount: 0,
    canImport: counts.VALID === outcomes.length && outcomes.length > 0,
    page: safePage,
    pageCount,
    outcomes: outcomes.slice((safePage - 1) * TEACHER_IMPORT_PREVIEW_PAGE_SIZE, safePage * TEACHER_IMPORT_PREVIEW_PAGE_SIZE),
  };
}
