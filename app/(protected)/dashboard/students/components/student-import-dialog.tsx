"use client";

import { importStudentsAction } from "@/actions/student-import.action";
import { ImportWizard } from "@/components/common/import/import-wizard";
import { normalizeStudentImportRow } from "@/lib/student-import-normalizer";
import { validateStudentImport } from "@/lib/student-import-validator";

export function StudentImportDialog() {
  return (
    <ImportWizard
      entityLabel="Student"
      queryKey={["students"]}
      normalizeRow={normalizeStudentImportRow}
      validateRows={validateStudentImport}
      importRecords={importStudentsAction}
    />
  );
}
