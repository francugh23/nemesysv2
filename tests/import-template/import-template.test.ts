import assert from "node:assert/strict";
import test from "node:test";

import * as XLSX from "xlsx";

import { subjectImportTemplateDefinition } from "../../lib/import/definitions/subject-import-template.definition";
import { studentImportTemplateDefinition } from "../../lib/import/definitions/student-import-template.definition";
import { generateImportTemplate } from "../../services/import-template.service";
import type { ImportTemplateDefinition } from "../../types/import-template";
import { normalizeStudentImportHeader } from "../../lib/student-import-normalizer";
import { normalizeSubjectImportHeader } from "../../app/(protected)/dashboard/subjects/lib/subject-import-normalizer";

function readWorkbook(contentBase64: string) {
  return XLSX.read(Buffer.from(contentBase64, "base64"));
}

function readRows(workbook: XLSX.WorkBook, sheetName: string) {
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
    header: 1,
  });
}

test("Student template has canonical headers and Instructions second", () => {
  const file = generateImportTemplate(studentImportTemplateDefinition);
  const workbook = readWorkbook(file.contentBase64);

  assert.equal(file.fileName, "nemesys-students-import-template.xlsx");
  assert.deepEqual(workbook.SheetNames, ["Students", "Instructions"]);
  assert.deepEqual(readRows(workbook, "Students"), [
    studentImportTemplateDefinition.importWorksheet.fields.map(
      (field) => field.canonicalHeader,
    ),
  ]);
  assert.deepEqual(readRows(workbook, "Instructions")[0], [
    "Field",
    "Required",
    "Accepted Values",
    "Format",
    "Notes",
  ]);
});

test("Subject template emits definition-backed instructions", () => {
  const file = generateImportTemplate(subjectImportTemplateDefinition);
  const workbook = readWorkbook(file.contentBase64);
  const instructions = readRows(workbook, "Instructions");

  assert.deepEqual(workbook.SheetNames, ["Subjects", "Instructions"]);
  assert.deepEqual(instructions[1], [
    "Code",
    "Yes",
    "Text",
    "Text",
    "Subject code.",
  ]);
  assert.equal(
    subjectImportTemplateDefinition.importWorksheet.fields.some(
      (field) => field.key === "semester",
    ),
    false,
  );
});

test("Templates keep Instructions second when additional worksheets are declared", () => {
  const definition: ImportTemplateDefinition = {
    fileSlug: "records",
    includeInstructions: true,
    importWorksheet: {
      sheetName: "Records",
      fields: [
        {
          key: "name",
          canonicalHeader: "Name",
          displayLabel: "Name",
          required: true,
          aliases: [],
          acceptedValues: "Text",
          format: "Text",
          notes: "Record name.",
        },
      ],
    },
    additionalWorksheets: [
      {
        sheetName: "Reference",
        fields: [
          {
            key: "value",
            canonicalHeader: "Value",
            displayLabel: "Value",
            required: false,
            aliases: [],
            acceptedValues: "Text",
            format: "Text",
            notes: "Reference value.",
          },
        ],
      },
    ],
  };

  const workbook = readWorkbook(generateImportTemplate(definition).contentBase64);

  assert.deepEqual(workbook.SheetNames, [
    "Records",
    "Instructions",
    "Reference",
  ]);
});

test("Definitions preserve existing Student and Subject header aliases", () => {
  assert.equal(normalizeStudentImportHeader("Learner Reference Number"), "lrn");
  assert.equal(normalizeStudentImportHeader("ZIP_code"), "zipCode");
  assert.equal(normalizeSubjectImportHeader("Subject Description"), "description");
  assert.equal(normalizeSubjectImportHeader("Semester"), undefined);
});

test("Template cells neutralize formula-like definition text", () => {
  const definition: ImportTemplateDefinition = {
    fileSlug: "formula",
    includeInstructions: false,
    importWorksheet: {
      sheetName: "Formula",
      fields: [
        {
          key: "formula",
          canonicalHeader: "=Header",
          displayLabel: "=Field",
          required: false,
          aliases: [],
          acceptedValues: "=Value",
          format: "=Format",
          notes: "=Note",
        },
      ],
    },
  };
  const workbook = readWorkbook(generateImportTemplate(definition).contentBase64);

  assert.deepEqual(workbook.SheetNames, ["Formula"]);
  assert.deepEqual(readRows(workbook, "Formula"), [["'=Header"]]);
});
