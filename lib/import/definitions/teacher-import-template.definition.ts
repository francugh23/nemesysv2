import type { ImportTemplateDefinition } from "@/types/import-template";

export const teacherImportTemplateDefinition: ImportTemplateDefinition = {
  fileSlug: "teachers",
  includeInstructions: true,
  importWorksheet: {
    sheetName: "Teachers",
    fields: [
      { key: "employeeNumber", canonicalHeader: "Employee Number *", displayLabel: "Employee Number", required: true, aliases: ["employee number", "employee no", "employee id"], acceptedValues: "Text", format: "Text", notes: "Trimmed and converted to uppercase. Must be unique, including inactive and archived Teachers." },
      { key: "firstName", canonicalHeader: "First Name *", displayLabel: "First Name", required: true, aliases: ["first name", "given name"], acceptedValues: "Text", format: "Text", notes: "Trimmed personnel first name." },
      { key: "middleName", canonicalHeader: "Middle Name", displayLabel: "Middle Name", required: false, aliases: ["middle name"], acceptedValues: "Text or blank", format: "Text", notes: "Optional; blank values are stored as empty personnel data." },
      { key: "lastName", canonicalHeader: "Last Name *", displayLabel: "Last Name", required: true, aliases: ["last name", "surname", "family name"], acceptedValues: "Text", format: "Text", notes: "Trimmed personnel last name." },
      { key: "gender", canonicalHeader: "Gender *", displayLabel: "Gender", required: true, aliases: ["gender", "sex"], acceptedValues: "MALE or FEMALE", format: "Uppercase enum", notes: "Only MALE and FEMALE are accepted." },
      { key: "email", canonicalHeader: "Email", displayLabel: "Email", required: false, aliases: ["email", "email address"], acceptedValues: "Valid email or blank", format: "name@example.com", notes: "Trimmed and converted to lowercase; cannot belong to another Teacher." },
      { key: "degree", canonicalHeader: "Degree", displayLabel: "Degree", required: false, aliases: ["degree"], acceptedValues: "Text or blank", format: "Text", notes: "Optional professional degree." },
      { key: "major", canonicalHeader: "Major", displayLabel: "Major", required: false, aliases: ["major", "specialization"], acceptedValues: "Text or blank", format: "Text", notes: "Optional specialization." },
    ],
  },
  instructionRows: [
    ["Import behavior", "All rows must be valid. Duplicate or conflicting rows block the entire import; no existing Teacher is updated, restored, or reactivated."],
    ["Accounts", "Import creates personnel records only. It never creates a login account, credentials, assignments, or adviser relationships."],
    ["Example", "EMP-001 | Ana | M. | Santos | FEMALE | ana.santos@example.com | BSEd | Mathematics"],
  ],
};
