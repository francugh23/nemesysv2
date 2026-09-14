import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import * as XLSX from "xlsx";

import { subjectAssignmentExportDefinition } from "../../lib/export/definitions/subject-assignment-export.definition";
import { subjectAssignmentImportTemplateDefinition } from "../../lib/import/definitions/subject-assignment-import-template.definition";
import { parseSpreadsheet } from "../../lib/import/spreadsheet";
import { normalizeSubjectAssignmentImportRow } from "../../lib/subject-assignment-import-normalizer";
import { SubjectAssignmentImportRowSchema, validateSubjectAssignmentImport } from "../../lib/subject-assignment-import-validator";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");
const canonicalHeaders = ["Grade", "Subject Code", "Section", "Term", "Teacher Employee Number"];

function spreadsheetFile(name: string, content: Uint8Array) {
  return {
    name,
    size: content.byteLength,
    arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength),
  } as File;
}

test("Phase 23-C4.3 keeps export and template canonical headers round-trip compatible", async () => {
  assert.deepEqual(subjectAssignmentExportDefinition.columns.slice(0, 5).map((column) => column.header), canonicalHeaders);
  assert.deepEqual(subjectAssignmentImportTemplateDefinition.importWorksheet.fields.map((field) => field.canonicalHeader.replace(" *", "")), canonicalHeaders);

  const row = subjectAssignmentExportDefinition.mapProjection({
    gradeLevel: "7", subjectCode: "MATH7", sectionName: "A", termName: "Term 1", employeeNumber: "T-001", subjectDescription: "Mathematics", teacherName: "Sample, Teacher", assignmentStatus: "Assigned",
  });
  const worksheet = XLSX.utils.aoa_to_sheet([subjectAssignmentExportDefinition.columns.map((column) => column.header), row]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Teaching Assignments");
  const content = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  const parsed = await parseSpreadsheet(spreadsheetFile("Teaching-Assignments_SY-2026-2027_Grade-7.xlsx", content));
  const normalized = normalizeSubjectAssignmentImportRow(parsed.rows[0]);

  assert.deepEqual(normalized, { gradeLevel: "7", subjectCode: "MATH7", section: "A", term: "Term 1", teacherEmployeeNumber: "T-001" });
  assert.equal(validateSubjectAssignmentImport([normalized], parsed.headers).valid, true);
  assert.doesNotMatch(JSON.stringify(normalized), /Mathematics|Sample, Teacher|Assigned/);
});

test("Phase 23-C4.3 makes unassigned rows and incomplete Teacher identity clear", () => {
  const row = subjectAssignmentExportDefinition.mapProjection({
    gradeLevel: "7", subjectCode: "MATH7", sectionName: "A", termName: "Term 1", employeeNumber: null, subjectDescription: "Mathematics", teacherName: "Unassigned", assignmentStatus: "Unassigned",
  });
  assert.deepEqual(row.slice(4), ["", "Mathematics", "Unassigned", "Unassigned"]);

  const incomplete = normalizeSubjectAssignmentImportRow({ Grade: "7", "Subject Code": "MATH7", Section: "A", Term: "Term 1", "Teacher Employee Number": "" });
  const validation = SubjectAssignmentImportRowSchema.safeParse(incomplete);
  assert.equal(validation.success, false);
  if (!validation.success) assert.equal(validation.error.issues[0]?.message, "Teacher Employee Number is required.");
});

test("Phase 23-C4.3 uses a readable filename and administrator-facing import UX", async () => {
  const [service, dialog, definition] = await Promise.all([
    read("services/subject-assignment.service.ts"),
    read("app/(protected)/dashboard/assignments/components/teaching-assignment-import-dialog.tsx"),
    read("lib/import/definitions/subject-assignment-import-template.definition.ts"),
  ]);

  assert.match(service, /Teaching-Assignments_SY-\$\{academicYearLabel\}_Grade-\$\{validated\.gradeLevel\}\.xlsx/);
  for (const label of ["Ready to assign", "Teacher will change", "Blocked/errors", "All changes will be applied as one transaction.", "Return to Teaching Matrix"]) assert.match(dialog, new RegExp(label));
  assert.match(dialog, /Assignments changed since Preview[\s\S]*Re-preview/);
  assert.match(dialog, /setStalePreview\(true\)[\s\S]*setSuccess\(result\.result\)/);
  assert.doesNotMatch(dialog, /<select|Prisma|P2002|P2034/);
  assert.match(definition, /Teacher names are informational/);
  assert.match(definition, /Preview changes nothing/);
});
