"use client";

import { importStudentsAction } from "@/actions/student-import.action";
import { downloadStudentImportTemplateAction } from "@/actions/student-import-template.action";
import { ImportWizard } from "@/components/common/import/import-wizard";
import { normalizeStudentImportRow } from "@/lib/student-import-normalizer";
import { validateStudentImport } from "@/lib/student-import-validator";
import type { ReactNode } from "react";

interface StudentImportDialogProps {
  trigger?: ReactNode;
}

export function StudentImportDialog({ trigger }: StudentImportDialogProps) {
  return (
    <ImportWizard
      entityLabel="Student"
      queryKey={["students"]}
      dependentQueryKeys={[["enrollment-form-options"]]}
      trigger={trigger}
      normalizeRow={normalizeStudentImportRow}
      validateRows={validateStudentImport}
      importRecords={importStudentsAction}
      downloadTemplate={downloadStudentImportTemplateAction}
    />
  );
}
