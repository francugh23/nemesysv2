"use client";

import {
  cloneElement,
  isValidElement,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { parseSpreadsheet } from "@/lib/import/spreadsheet";
import type { ActionResponse } from "@/types/action-response";
import type { ImportValidationResult } from "@/types/import";
import { WizardDialog } from "@/components/common/wizard/wizard-dialog";
import { WizardStepPreview } from "@/components/common/wizard/wizard-step-preview";
import { WizardStepSummary } from "@/components/common/wizard/wizard-step-summary";
import { WizardStepUpload } from "@/components/common/wizard/wizard-step-upload";
import { WizardStepValidation } from "@/components/common/wizard/wizard-step-validation";

interface ImportWizardProps {
  entityLabel: string;
  queryKey: readonly unknown[];
  trigger?: ReactNode;
  normalizeRow: (row: Record<string, unknown>) => Record<string, unknown>;
  validateRows: (
    rows: Record<string, unknown>[],
    headers: string[],
  ) => ImportValidationResult;
  importRecords: (rows: Record<string, unknown>[]) => Promise<ActionResponse>;
}

export function ImportWizard({
  entityLabel,
  queryKey,
  trigger,
  normalizeRow,
  validateRows,
  importRecords,
}: ImportWizardProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const normalizeRowEvent = useEffectEvent(normalizeRow);

  useEffect(() => {
    if (!file) return;

    let cancelled = false;

    void parseSpreadsheet(file)
      .then((spreadsheet) => {
        if (cancelled) return;

        setHeaders(spreadsheet.headers);
        setRows(spreadsheet.rows.map((row) => normalizeRowEvent(row)));
      })
      .catch(() => {
        if (!cancelled) {
          setHeaders([]);
          setRows([]);
          toast.error("Unable to parse the selected file.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  const validation = validateRows(rows, headers);
  const importRows = validation.valid ? rows : [];

  function resetWizard() {
    setFile(null);
    setRows([]);
    setHeaders([]);
  }

  function handleOpenChange(value: boolean) {
    setOpen(value);

    if (!value) {
      resetWizard();
    }
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setRows([]);
    setHeaders([]);
  }

  function handleImport() {
    if (!validation.valid || importRows.length === 0) return;

    startTransition(async () => {
      const result = await importRecords(importRows);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      await queryClient.invalidateQueries({ queryKey });
      handleOpenChange(false);
    });
  }

  return (
    <>
      {trigger && isValidElement<{ onClick?: () => void }>(trigger) ? (
        cloneElement(trigger, {
          onClick: () => handleOpenChange(true),
        })
      ) : (
        <Button onClick={() => handleOpenChange(true)}>Import {entityLabel}</Button>
      )}

      <WizardDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={`Import ${entityLabel}s`}
        onFinish={handleImport}
        isFinishing={isPending}
        isFinishDisabled={!validation.valid || importRows.length === 0}
        steps={[
          {
            id: "upload",
            title: "Upload File",
            description: "Upload your Excel or CSV file.",
            content: (
              <WizardStepUpload
                entityLabel={entityLabel}
                file={file}
                onFileChange={handleFileChange}
              />
            ),
          },
          {
            id: "preview",
            title: "Preview",
            description: "Review detected records.",
            content: <WizardStepPreview file={file} rows={rows} />,
          },
          {
            id: "validation",
            title: "Validation",
            description: "Review errors before importing.",
            content: <WizardStepValidation result={validation} />,
          },
          {
            id: "summary",
            title: "Summary",
            description: "Review records before importing.",
            content: <WizardStepSummary entityLabel={entityLabel} rows={importRows} />,
          },
        ]}
      />
    </>
  );
}
