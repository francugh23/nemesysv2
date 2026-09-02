"use client";

import type { ReactNode } from "react";

import { confirmTeacherImportAction, previewTeacherImportAction } from "@/actions/teacher-import.action";
import { downloadTeacherImportTemplateAction } from "@/actions/teacher-import-template.action";
import { ImportWizard } from "@/components/common/import/import-wizard";
import { normalizeTeacherImportRow } from "@/lib/teacher-import-normalizer";
import { validateTeacherImport } from "@/lib/teacher-import-validator";

interface TeacherImportDialogProps {
  trigger?: ReactNode;
}

export function TeacherImportDialog({ trigger }: TeacherImportDialogProps) {
  return (
    <ImportWizard
      entityLabel="Teacher"
      queryKey={["teachers"]}
      dependentQueryKeys={[
        ["subject-assignment-options"],
        ["section-form-options"],
        ["dashboard", "operational"],
      ]}
      trigger={trigger}
      normalizeRow={normalizeTeacherImportRow}
      validateRows={validateTeacherImport}
      importRecords={confirmTeacherImportAction}
      confirmRecords={confirmTeacherImportAction}
      previewRecords={previewTeacherImportAction}
      downloadTemplate={downloadTeacherImportTemplateAction}
      maxFileSizeBytes={2 * 1024 * 1024}
      maxRows={500}
    />
  );
}
