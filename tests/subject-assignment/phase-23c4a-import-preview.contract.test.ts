import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import * as XLSX from "xlsx";

import { subjectAssignmentImportTemplateDefinition } from "../../lib/import/definitions/subject-assignment-import-template.definition";
import { parseSpreadsheet } from "../../lib/import/spreadsheet";
import { normalizeSubjectAssignmentImportRow } from "../../lib/subject-assignment-import-normalizer";
import { validateSubjectAssignmentImport } from "../../lib/subject-assignment-import-validator";
import { generateImportTemplate } from "../../services/import-template.service";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

function spreadsheetFile(name: string, content: Uint8Array) {
  return {
    name,
    size: content.byteLength,
    arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength),
  } as File;
}

test("Phase 23-C4.1 creates a safe Grade-scoped Teaching Assignments template", () => {
  const file = generateImportTemplate(subjectAssignmentImportTemplateDefinition);
  const workbook = XLSX.read(Buffer.from(file.contentBase64, "base64"));
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets["Teaching Assignments"], { header: 1 });
  const instructions = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Instructions, { header: 1 });

  assert.deepEqual(workbook.SheetNames, ["Teaching Assignments", "Instructions"]);
  assert.deepEqual(rows[0], ["Grade *", "Subject Code *", "Section *", "Term *", "Teacher Employee Number *"]);
  assert.ok(instructions.some((row) => row.join(" ").includes("never creates Teachers")));
  assert.ok(instructions.some((row) => row.join(" ").includes("Preview makes no database changes")));
  assert.doesNotMatch(JSON.stringify(rows), /^(=|\+|-|@)/m);
});

test("Phase 23-C4.1 accepts XLSX/CSV and bounds assignment files to 2,000 rows", async () => {
  const csv = new TextEncoder().encode("Grade *,Subject Code *,Section *,Term *,Teacher Employee Number *\n7,MATH7,A,Term 1,T-001\n");
  const parsed = await parseSpreadsheet(spreadsheetFile("assignments.csv", csv), { maxFileSizeBytes: 1024, maxRows: 2000 });
  assert.equal(parsed.rows.length, 1);

  const worksheet = XLSX.utils.aoa_to_sheet([["Grade *"], ...Array.from({ length: 2001 }, () => ["7"])]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Teaching Assignments");
  const xlsx = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  await assert.rejects(() => parseSpreadsheet(spreadsheetFile("assignments.xlsx", xlsx), { maxRows: 2000 }), /2000-row limit/);
  await assert.rejects(() => parseSpreadsheet(spreadsheetFile("assignments.txt", csv)), /XLSX and CSV/);
});

test("Phase 23-C4.1 normalizes business keys and requires no database IDs", () => {
  const row = normalizeSubjectAssignmentImportRow({
    "Grade *": " 7 ",
    "Subject Code *": " math7 ",
    "Section *": " Grade 7   A ",
    "Term *": " Term 1 ",
    "Teacher Employee Number *": " t-001 ",
  });
  assert.deepEqual(row, {
    gradeLevel: "7",
    subjectCode: "MATH7",
    section: "Grade 7   A",
    term: "Term 1",
    teacherEmployeeNumber: "T-001",
  });
  assert.equal(validateSubjectAssignmentImport([row], ["Grade *", "Subject Code *", "Section *", "Term *", "Teacher Employee Number *"]).valid, true);
  assert.equal(validateSubjectAssignmentImport([row], ["Grade *"]).valid, false);
});

test("Phase 23-C4.1 previews Grade-scoped assignment ownership with deterministic classifications", async () => {
  const [schema, service, repository, action] = await Promise.all([
    read("schemas/subject-assignment.schema.ts"),
    read("services/subject-assignment.service.ts"),
    read("repositories/subject-assignment.repository.ts"),
    read("actions/subject-assignment.action.ts"),
  ]);

  for (const classification of ["VALID", "ALREADY_ASSIGNED", "CHANGE", "PROTECTED", "TEACHER_NOT_FOUND", "INACTIVE_TEACHER", "ARCHIVED_TEACHER", "SECTION_NOT_FOUND", "OFFERING_NOT_FOUND", "TERM_NOT_FOUND", "TERM_NOT_APPLICABLE", "GRADE_MISMATCH", "UNAPPROVED_SHS", "DUPLICATE_IN_FILE", "AMBIGUOUS_SECTION", "AMBIGUOUS_OFFERING", "AMBIGUOUS_TERM", "INVALID"]) {
    assert.match(service, new RegExp(`"${classification}"`));
  }
  assert.match(schema, /rows: z\.array\(z\.record\(z\.string\(\), z\.unknown\(\)\)\)\.min\(1\)\.max\(2000\)/);
  assert.match(service, /TransactionIsolationLevel\.RepeatableRead/);
  assert.match(service, /termHasStarted\(term\.startDate\)[\s\S]*classification = "PROTECTED"/);
  assert.match(service, /teacherLabel\(existing\.teacher\)/);
  assert.match(service, /duplicateScopeCounts/);
  assert.match(repository, /findSubjectAssignmentImportContext[\s\S]*findMany/);
  assert.match(repository, /findSubjectAssignmentImportAssignments/);
  assert.match(action, /requirePermission\(Permissions\.SUBJECT_ASSIGNMENTS\)/);
  assert.doesNotMatch(service.slice(service.indexOf("export async function previewSubjectAssignmentImport"), service.indexOf("export async function exportSubjectAssignments")), /createSubjectAssignment|updateSubjectAssignment|archiveSubjectAssignment|createAuditLogs/);
});

test("Phase 23-C4.1 exports assigned and unassigned eligible Grade scopes without IDs", async () => {
  const [service, repository, definition, dialog] = await Promise.all([
    read("services/subject-assignment.service.ts"),
    read("repositories/subject-assignment.repository.ts"),
    read("lib/export/definitions/subject-assignment-export.definition.ts"),
    read("app/(protected)/dashboard/assignments/components/teaching-assignment-import-dialog.tsx"),
  ]);

  assert.match(service, /generateExport\(undefined, "xlsx"/);
  assert.match(service, /context\.scopes\.flatMap\(\(scope\) => context\.sections\.map/);
  assert.match(repository, /gradeLevel,\n\s*deletedAt: null/);
  assert.match(repository, /curriculumStatus: "SCHOOL_APPROVED"/);
  assert.match(definition, /"Teacher Employee Number"[\s\S]*"Current Assignment Status"/);
  assert.doesNotMatch(definition, /\bid\b/i);
  assert.match(dialog, /h-\[80vh\]/);
  assert.match(dialog, /Preview complete\. No teaching assignments have been changed\./);
  assert.doesNotMatch(dialog, />Apply<|>Import<|>Confirm</);
});
