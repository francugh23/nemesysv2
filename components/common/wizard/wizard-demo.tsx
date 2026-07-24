"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { importStudentsAction } from "@/actions/student-import.action";

import { WizardDialog } from "./wizard-dialog";

import { WizardStepUpload } from "./wizard-step-upload";
import { WizardStepPreview } from "./wizard-step-preview";
import { WizardStepValidation } from "./wizard-step-validation";
import { WizardStepSummary } from "./wizard-step-summary";
import type { ImportValidationError } from "@/lib/student-import-validator";

export function WizardDemo() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [validation, setValidation] = useState<{
    valid: boolean;
    errors: ImportValidationError[];
  }>({
    valid: false,
    errors: [],
  });

  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);

  function resetWizard() {
    setFile(null);
    setRows([]);
    setValidation({ valid: false, errors: [] });
    setImportRows([]);
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);

    if (!value) {
      resetWizard();
    }
  }

  function handleImport() {
    if (!validation.valid || importRows.length === 0) {
      return;
    }

    startTransition(async () => {
      const result = await importStudentsAction(importRows);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);

      await queryClient.invalidateQueries({
        queryKey: ["students"],
      });

      handleOpenChange(false);
    });
  }

  return (
    <>
      <Button onClick={() => handleOpenChange(true)}>Open Import Wizard</Button>

      <WizardDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Import Students"
        onFinish={handleImport}
        isFinishing={isPending}
        isFinishDisabled={!validation.valid || importRows.length === 0}
        steps={[
          {
            id: "upload",
            title: "Upload File",
            description: "Upload your Excel or CSV file.",
            content: <WizardStepUpload file={file} onFileChange={setFile} />,
          },
          {
            id: "preview",
            title: "Preview",
            description: "Review detected records.",
            content: <WizardStepPreview file={file} onRowsLoaded={setRows} />,
          },
          {
            id: "validation",
            title: "Validation",
            description: "Review errors before importing.",
            content: (
              <WizardStepValidation
                rows={rows}
                onValidation={setValidation}
                onValidRows={setImportRows}
              />
            ),
          },
          {
            id: "summary",
            title: "Summary",
            description: "Import completed.",
            content: <WizardStepSummary rows={importRows} />,
          },
        ]}
      />
    </>
  );
}
