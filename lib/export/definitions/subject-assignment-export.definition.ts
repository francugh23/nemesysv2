export const subjectAssignmentExportDefinition = {
  fileSlug: "teaching-assignments",
  sheetName: "Teaching Assignments",
  columns: [
    { header: "Grade" },
    { header: "Subject Code" },
    { header: "Section" },
    { header: "Term" },
    { header: "Teacher Employee Number" },
    { header: "Subject" },
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
    assignmentStatus: "Assigned" | "Unassigned";
  }) => [
    record.gradeLevel,
    record.subjectCode,
    record.sectionName,
    record.termName,
    record.employeeNumber ?? "",
    record.subjectDescription,
    record.teacherName ?? "",
    record.assignmentStatus,
  ],
} as const;
