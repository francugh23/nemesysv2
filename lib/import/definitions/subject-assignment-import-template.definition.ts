import type { ImportTemplateDefinition } from "@/types/import-template";

export const subjectAssignmentImportTemplateDefinition = {
  fileSlug: "teaching-assignments",
  includeInstructions: true,
  importWorksheet: {
    sheetName: "Teaching Assignments",
    fields: [
      { key: "gradeLevel", canonicalHeader: "Grade *", displayLabel: "Grade", required: true, aliases: ["grade", "grade level"], acceptedValues: "7 through 12", format: "Number", notes: "Must match the selected Grade in NEMESYS." },
      { key: "subjectCode", canonicalHeader: "Subject Code *", displayLabel: "Subject Code", required: true, aliases: ["subject code", "subject"], acceptedValues: "Configured Curriculum Offering code", format: "Text", notes: "Must exactly match an active Curriculum Offering code in the active Academic Year." },
      { key: "section", canonicalHeader: "Section *", displayLabel: "Section", required: true, aliases: ["section", "section name"], acceptedValues: "Active Section name", format: "Text", notes: "Must exactly match one active Section." },
      { key: "term", canonicalHeader: "Term *", displayLabel: "Term", required: true, aliases: ["term", "academic term"], acceptedValues: "Configured Term name, 1, 2, 3, or Term 1, Term 2, Term 3", format: "Text", notes: "Must identify exactly one configured Term in the active Academic Year." },
      { key: "teacherEmployeeNumber", canonicalHeader: "Teacher Employee Number *", displayLabel: "Teacher Employee Number", required: true, aliases: ["teacher employee number", "teacher employee no", "employee number", "teacher id"], acceptedValues: "Active Teacher employee number", format: "Text", notes: "Employee Number identifies the Teacher. Names are informational only; Teachers are never created here." },
    ],
  },
  instructionRows: [
    ["Scope", "Select one Grade before previewing. The server resolves the single ACTIVE Academic Year; do not include an Academic Year ID."],
    ["Matching", "Grade, Subject Code, Section, and configured Term must resolve to one exact active assignment scope. Ambiguous matches are not selected."],
    ["Teachers", "Use Teacher Employee Number, not Teacher name. This workflow never creates Teachers; create or import personnel through Teacher Management first."],
    ["Term", "Use the configured Term name, its numeric position (for example, 1), or Term plus its position (for example, Term 1)."],
    ["SHS", "Grade 11 and Grade 12 Offerings must be school approved. Rows do not create, replace, clear, or change assignments."],
    ["Preview", "One row represents one exact Offering-Term-Section assignment scope. Preview makes no database changes."],
  ],
} satisfies ImportTemplateDefinition;
