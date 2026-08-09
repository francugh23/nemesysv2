"use client";

import { importSubjectsAction } from "@/actions/subject-import.action";
import { downloadSubjectImportTemplateAction } from "@/actions/subject-import-template.action";
import { ImportWizard } from "@/components/common/import/import-wizard";
import type { ReactNode } from "react";

import { normalizeSubjectImportRow } from "../lib/subject-import-normalizer";
import { validateSubjectImport } from "../lib/subject-import-validator";
interface SubjectImportDialogProps {
  trigger?: ReactNode;
}

export function SubjectImportDialog({ trigger }: SubjectImportDialogProps) {
  return (
    <ImportWizard
      entityLabel="Subject"
      queryKey={["subjects"]}
      dependentQueryKeys={[["subject-assignment-options"]]}
      trigger={trigger}
      normalizeRow={normalizeSubjectImportRow}
      validateRows={validateSubjectImport}
      importRecords={importSubjectsAction}
      downloadTemplate={downloadSubjectImportTemplateAction}
    />
  );
}
