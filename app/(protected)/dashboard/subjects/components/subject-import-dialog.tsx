"use client";

import { importSubjectsAction } from "@/actions/subject-import.action";
import { ImportWizard } from "@/components/common/import/import-wizard";

import { normalizeSubjectImportRow } from "../lib/subject-import-normalizer";
import { validateSubjectImport } from "../lib/subject-import-validator";

export function SubjectImportDialog() {
  return (
    <ImportWizard
      entityLabel="Subject"
      queryKey={["subjects"]}
      normalizeRow={normalizeSubjectImportRow}
      validateRows={validateSubjectImport}
      importRecords={importSubjectsAction}
    />
  );
}
