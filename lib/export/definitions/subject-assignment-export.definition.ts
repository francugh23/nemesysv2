export const subjectAssignmentExportDefinition = {
  fileSlug: "teaching-assignments",
  sheetName: "Teaching Assignments",
  columns: [
    { header: "Grade" },
    { header: "Subject Code" },
    { header: "Subject" },
    { header: "Section" },
    { header: "Term" },
    { header: "Teacher Employee Number" },
    { header: "Teacher" },
    { header: "Current Assignment Status" },
  ],
  mapProjection: (record: {
    gradeLevel: string;
    subjectCode: string;
    subjectDescription: string;
    sectionName: string;
    termName: string;
    employeeNumber: string | null;
    teacherName: string | null;
  }) => [
    record.gradeLevel,
    record.subjectCode,
    record.subjectDescription,
    record.sectionName,
    record.termName,
    record.employeeNumber ?? "",
    record.teacherName ?? "",
    record.teacherName ? "ASSIGNED" : "UNASSIGNED",
  ],
} as const;
