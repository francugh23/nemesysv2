import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import * as XLSX from "xlsx";

import { teacherImportTemplateDefinition } from "../../lib/import/definitions/teacher-import-template.definition";
import { parseSpreadsheet } from "../../lib/import/spreadsheet";
import { normalizeTeacherImportRow } from "../../lib/teacher-import-normalizer";
import { classifyTeacherImportRows } from "../../lib/teacher-import-preview";
import { validateTeacherImport } from "../../lib/teacher-import-validator";
import { generateImportTemplate } from "../../services/import-template.service";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

function spreadsheetFile(name: string, content: Uint8Array) {
  return {
    name,
    size: content.byteLength,
    arrayBuffer: async () => content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength),
  } as File;
}

test("Phase 23-B2 Teacher template has exact safe workbook structure and instructions", () => {
  const file = generateImportTemplate(teacherImportTemplateDefinition);
  const workbook = XLSX.read(Buffer.from(file.contentBase64, "base64"));
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Teachers, { header: 1 });
  const instructions = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Instructions, { header: 1 });
  assert.deepEqual(workbook.SheetNames, ["Teachers", "Instructions"]);
  assert.deepEqual(rows[0], ["Employee Number *", "First Name *", "Middle Name", "Last Name *", "Gender *", "Email", "Degree", "Major"]);
  assert.ok(instructions.some((row) => row.includes("Example")));
  assert.ok(instructions.some((row) => row.join(" ").includes("never creates a login account")));
  assert.doesNotMatch(JSON.stringify(rows), /^(=|\+|-|@)/m);
});

test("Phase 23-B2 accepts CSV/XLSX and bounds parsing before preview", async () => {
  const csv = new TextEncoder().encode("Employee Number *,First Name *,Last Name *,Gender *\nt-001,Ana,Santos,FEMALE\n");
  const parsedCsv = await parseSpreadsheet(spreadsheetFile("teachers.csv", csv), { maxFileSizeBytes: 1024, maxRows: 2 });
  assert.equal(parsedCsv.rows.length, 1);
  await assert.rejects(() => parseSpreadsheet(spreadsheetFile("teachers.csv", csv), { maxFileSizeBytes: 1 }), /maximum file size/);
  const worksheet = XLSX.utils.aoa_to_sheet([["Employee Number *"], ["T-1"], ["T-2"]]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Teachers");
  const xlsx = new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  await assert.rejects(() => parseSpreadsheet(spreadsheetFile("teachers.xlsx", xlsx), { maxRows: 1 }), /row limit/);
  await assert.rejects(() => parseSpreadsheet(spreadsheetFile("teachers.txt", csv)), /XLSX and CSV/);
  const instructionsFirst = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(instructionsFirst, XLSX.utils.aoa_to_sheet([["Ignore"]]), "Instructions");
  XLSX.utils.book_append_sheet(instructionsFirst, XLSX.utils.aoa_to_sheet([["Employee Number *"], ["T-3"]]), "Teachers");
  const instructionsFirstFile = new Uint8Array(XLSX.write(instructionsFirst, { type: "array", bookType: "xlsx" }) as ArrayBuffer);
  assert.equal((await parseSpreadsheet(spreadsheetFile("instructions-first.xlsx", instructionsFirstFile))).headers[0], "Employee Number *");
});

test("Phase 23-B2 normalizes Teacher personnel input and blocks local structural errors", () => {
  const normalized = normalizeTeacherImportRow({ "Employee Number *": " t-001 ", "First Name *": " Ana ", "Middle Name": " ", "Last Name *": " Santos ", "Gender *": "female", Email: " ANA@EXAMPLE.COM ", Degree: " ", Major: " Mathematics " });
  assert.deepEqual(normalized, { employeeNumber: "T-001", firstName: "Ana", middleName: undefined, lastName: "Santos", gender: "FEMALE", email: "ana@example.com", degree: undefined, major: "Mathematics" });
  assert.equal(validateTeacherImport([normalized], ["Employee Number *", "First Name *", "Last Name *", "Gender *"]).valid, true);
  assert.equal(validateTeacherImport([{ ...normalized, gender: "OTHER" }], ["Employee Number *", "First Name *", "Last Name *", "Gender *"]).valid, false);
  assert.equal(validateTeacherImport([{ ...normalized, email: "invalid" }], ["Employee Number *", "First Name *", "Last Name *", "Gender *"]).valid, false);
  assert.equal(validateTeacherImport([normalized, normalized], ["Employee Number *", "First Name *", "Last Name *", "Gender *"]).valid, false);
});

test("Phase 23-B2 preview classifies every collision deterministically and bounds projection", () => {
  const base = { firstName: "Ana", lastName: "Santos", gender: "FEMALE" };
  const preview = classifyTeacherImportRows([
    { ...base, employeeNumber: "valid" },
    { ...base, employeeNumber: "dupe" }, { ...base, employeeNumber: "DUPE" },
    { ...base, employeeNumber: "active" }, { ...base, employeeNumber: "inactive" },
    { ...base, employeeNumber: "archived" }, { ...base, employeeNumber: "email", email: "used@example.com" },
    { ...base, employeeNumber: "invalid", gender: "OTHER" },
  ], [
    { employeeNumber: "ACTIVE", email: null, status: "ACTIVE", deletedAt: null },
    { employeeNumber: "INACTIVE", email: null, status: "INACTIVE", deletedAt: null },
    { employeeNumber: "ARCHIVED", email: null, status: "ACTIVE", deletedAt: new Date() },
    { employeeNumber: "OTHER", email: "used@example.com", status: "ACTIVE", deletedAt: null },
  ], 1);
  assert.deepEqual(preview.counts, { VALID: 1, DUPLICATE_IN_FILE: 2, EXISTING_ACTIVE: 1, EXISTING_INACTIVE: 1, EXISTING_ARCHIVED: 1, EMAIL_COLLISION: 1, INVALID: 1 });
  assert.equal(preview.canImport, false);
  const paged = classifyTeacherImportRows(Array.from({ length: 30 }, (_, index) => ({ ...base, employeeNumber: `T-${index}` })), [], 2);
  assert.equal(paged.outcomes.length, 5);
  assert.equal(paged.pageCount, 2);
});

test("Phase 23-B2 confirmation revalidates transactionally and creates personnel records only", async () => {
  const [service, action, repository] = await Promise.all([read("services/teacher.service.ts"), read("actions/teacher-import.action.ts"), read("repositories/teacher.repository.ts")]);
  assert.match(action, /requirePermission\(Permissions\.TEACHERS\)/);
  assert.match(service, /getTeacherImportPreview\(rows, 1, transaction\)/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /TEACHER_IMPORT_BATCH_SIZE = 100/);
  assert.match(service, /status: "ACTIVE"/);
  assert.match(service, /userId: null/);
  assert.match(service, /module: "TeacherImport"/);
  assert.match(service, /metadata: \{ batchId, count: teachers\.length \}/);
  assert.match(service, /P2002[\s\S]*P2034/);
  assert.match(repository, /findTeachersForImport/);
  assert.doesNotMatch(service, /subjectAssignment\.create|user\.create/);
});

test("Phase 23-B2 shared wizard preview is opt-in and remains bounded", async () => {
  const [wizard, student, subject, dialog] = await Promise.all([
    read("components/common/import/import-wizard.tsx"),
    read("app/(protected)/dashboard/students/components/student-import-dialog.tsx"),
    read("app/(protected)/dashboard/subjects/components/subject-import-dialog.tsx"),
    read("components/common/wizard/wizard-dialog.tsx"),
  ]);
  assert.match(wizard, /previewRecords\?:/);
  assert.match(wizard, /confirmRecords\?:/);
  assert.doesNotMatch(student, /previewRecords|confirmRecords/);
  assert.doesNotMatch(subject, /previewRecords|confirmRecords/);
  assert.match(dialog, /h-\[80vh\][\s\S]*overflow-hidden/);
  assert.match(dialog, /ScrollArea className="min-h-0 flex-1/);
});

test("Phase 23-B2 supports representative 100-row client validation without unbounded preview cards", () => {
  const rows = Array.from({ length: 100 }, (_, index) => ({ employeeNumber: `T-${index}`, firstName: "Ana", lastName: "Santos", gender: "FEMALE" }));
  const result = validateTeacherImport(rows, ["Employee Number *", "First Name *", "Last Name *", "Gender *"]);
  assert.equal(result.valid, true);
});
