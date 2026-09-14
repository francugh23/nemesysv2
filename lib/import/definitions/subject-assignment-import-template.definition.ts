import type { ImportTemplateDefinition } from "@/types/import-template";

export const subjectAssignmentImportTemplateDefinition = {
  fileSlug: "teaching-assignments",
  includeInstructions: true,
  importWorksheet: {
    sheetName: "Teaching Assignments",
    fields: [
      { key: "gradeLevel", canonicalHeader: "Grade *", displayLabel: "Grade", required: true, aliases: ["grade", "grade level"], acceptedValues: "7 through 12", format: "Number", notes: "Must match the selected Grade in NEMESYS." },
      { key: "subjectCode", canonicalHeader: "Subject Code *", displayLabel: "Subject Code", required: true, aliases: ["subject code"], acceptedValues: "Configured Curriculum Offering code", format: "Text", notes: "Must exactly match an active Curriculum Offering code in the active Academic Year." },
      { key: "section", canonicalHeader: "Section *", displayLabel: "Section", required: true, aliases: ["section", "section name"], acceptedValues: "Active Section name", format: "Text", notes: "Must exactly match one active Section." },
      { key: "term", canonicalHeader: "Term *", displayLabel: "Term", required: true, aliases: ["term", "academic term"], acceptedValues: "Configured Term name, 1, 2, 3, or Term 1, Term 2, Term 3", format: "Text", notes: "Must identify exactly one configured Term in the active Academic Year." },
      { key: "teacherEmployeeNumber", canonicalHeader: "Teacher Employee Number *", displayLabel: "Teacher Employee Number", required: true, aliases: ["teacher employee number", "teacher employee no", "employee number", "teacher id"], acceptedValues: "Active Teacher employee number", format: "Text", notes: "Employee Number identifies the Teacher. Names are informational only; Teachers are never created here." },
    ],
  },
  instructionRows: [
    ["Scope", "This workbook is for one selected Grade in the ACTIVE Academic Year."],
    ["Rows", "Each row is one exact Subject Offering, Term, and Section assignment scope. Use existing Subject Codes, Sections, and Terms."],
    ["Teacher", "Teacher Employee Number identifies the Teacher. Teacher names are informational. Teachers must already exist in Teacher Management."],
    ["Started Terms", "A started Term with an assigned Teacher cannot be replaced. A started unassigned Term may receive its first Teacher."],
    ["Preview", "Preview changes nothing. Confirmation applies the complete batch together."],
    ["Review", "If assignments change after Preview, preview the file again before confirmation."],
  ],
} satisfies ImportTemplateDefinition;
