"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { WizardStepUpload } from "@/components/common/wizard/wizard-step-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useConfirmSubjectAssignmentImport,
  useExportSubjectAssignments,
  usePreviewSubjectAssignmentImport,
  useSubjectAssignmentImportTemplate,
} from "@/hooks/subject-assignment.hook";
import { downloadExportFile } from "@/lib/export/download";
import { parseSpreadsheet } from "@/lib/import/spreadsheet";
import { normalizeSubjectAssignmentImportRow } from "@/lib/subject-assignment-import-normalizer";
import { validateSubjectAssignmentImport } from "@/lib/subject-assignment-import-validator";

const previewLabels = {
  VALID: "Ready to assign",
  ALREADY_ASSIGNED: "Already assigned",
  CHANGE: "Teacher will change",
  PROTECTED: "Protected",
  TEACHER_NOT_FOUND: "Teacher not found",
  INACTIVE_TEACHER: "Teacher inactive",
  ARCHIVED_TEACHER: "Teacher archived",
  SECTION_NOT_FOUND: "Section not found",
  OFFERING_NOT_FOUND: "Subject offering not found",
  TERM_NOT_FOUND: "Term not found",
  TERM_NOT_APPLICABLE: "Term not applicable",
  GRADE_MISMATCH: "Grade mismatch",
  UNAPPROVED_SHS: "Unapproved SHS",
  DUPLICATE_IN_FILE: "Duplicate assignment scope",
  AMBIGUOUS_SECTION: "Ambiguous Section",
  AMBIGUOUS_OFFERING: "Ambiguous Offering",
  AMBIGUOUS_TERM: "Ambiguous Term",
  INVALID: "Incomplete or invalid row",
} as const;

type GradeLevel = "7" | "8" | "9" | "10" | "11" | "12";
type PreviewClassification = keyof typeof previewLabels;
type AssignmentPreview = {
  academicYear: string;
  fingerprint: string;
  totalRows: number;
  counts: Record<PreviewClassification, number>;
  page: number;
  pageCount: number;
  outcomes: Array<{
    rowNumber: number;
    gradeLevel: string;
    subjectCode: string;
    section: string;
    term: string;
    requestedTeacher: string;
    currentTeacher: string;
    classification: PreviewClassification;
    issue: string | null;
  }>;
};

interface TeachingAssignmentImportDialogProps {
  gradeLevel: GradeLevel;
  academicYearLabel: string;
}

export function TeachingAssignmentImportDialog({
  gradeLevel,
  academicYearLabel,
}: TeachingAssignmentImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [stalePreview, setStalePreview] = useState(false);
  const [success, setSuccess] = useState<{ batchId: string; createdCount: number; updatedCount: number; unchangedCount: number } | null>(null);
  const previewMutation = usePreviewSubjectAssignmentImport();
  const confirmMutation = useConfirmSubjectAssignmentImport();
  const exportMutation = useExportSubjectAssignments();
  const templateMutation = useSubjectAssignmentImportTemplate();
  const [isParsing, startParsing] = useTransition();

  function reset() {
    setFile(null);
    setPreviewRows([]);
    setPreview(null);
    setStalePreview(false);
    setSuccess(null);
  }

  async function requestPreview(rows: Record<string, unknown>[], page: number) {
    const result = await previewMutation.mutateAsync({ rows, gradeLevel, page });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setPreview(result.preview as AssignmentPreview);
    setStalePreview(false);
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setPreviewRows([]);
    setPreview(null);
    setStalePreview(false);
    setSuccess(null);
    if (!nextFile) return;

    startParsing(async () => {
      try {
        const spreadsheet = await parseSpreadsheet(nextFile, {
          maxFileSizeBytes: 2 * 1024 * 1024,
          maxRows: 2000,
        });
        const rows = spreadsheet.rows.map(normalizeSubjectAssignmentImportRow);
        const validation = validateSubjectAssignmentImport(rows, spreadsheet.headers);
        if (!validation.valid) {
          toast.error(validation.errors[0]?.message ?? "The file is missing required assignment columns.");
          return;
        }
        setPreviewRows(rows);
        await requestPreview(rows, 1);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to parse the selected file.");
      }
    });
  }

  function handleTemplateDownload() {
    templateMutation.mutate(undefined, {
      onSuccess: (result) => {
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        downloadExportFile(result.file);
      },
      onError: () => toast.error("Unable to download the teaching assignment template."),
    });
  }

  function handleExport() {
    exportMutation.mutate(gradeLevel, {
      onSuccess: (result) => {
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        downloadExportFile(result.file);
        toast.success(`${result.file.rowCount.toLocaleString("en-US")} assignment scope${result.file.rowCount === 1 ? "" : "s"} exported.`);
      },
      onError: () => toast.error("Unable to export teaching assignments."),
    });
  }

  function handleConfirm() {
    if (!preview) return;
    confirmMutation.mutate({ rows: previewRows, gradeLevel, previewFingerprint: preview.fingerprint }, {
      onSuccess: (result) => {
        if ("error" in result) {
          const message = result.error ?? "Unable to confirm teaching assignments.";
          if (/changed after this file was previewed/i.test(message)) {
            setStalePreview(true);
            toast.error("Assignments changed since Preview. Re-preview the file before confirming.");
          } else {
            toast.error(message);
          }
          return;
        }
        setSuccess(result.result);
        toast.success("Teaching assignments were updated.");
      },
      onError: () => toast.error("Unable to confirm teaching assignments."),
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={handleExport} disabled={exportMutation.isPending}>
          {exportMutation.isPending ? <Loader2 className="animate-spin" /> : <Download />}
          Export assignments
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <Upload />
          Import assignments
        </Button>
      </div>
      <FormDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) reset();
        }}
        title={`Teaching Assignment Import - ${academicYearLabel}`}
        maxWidth="max-w-6xl! h-[80vh]"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">ACTIVE Academic Year: <strong className="text-foreground">{academicYearLabel}</strong></span>
            <Badge variant="outline">Grade {gradeLevel}</Badge>
          </div>
          {!success && <WizardStepUpload
            entityLabel="Teaching Assignment"
            file={file}
            onFileChange={handleFileChange}
            onTemplateDownload={handleTemplateDownload}
            isDownloadingTemplate={templateMutation.isPending}
          />}
          {!success && (isParsing || previewMutation.isPending) && (
            <div className="flex items-center justify-center gap-2 rounded-md border p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Resolving teaching assignment scopes...
            </div>
          )}
          {success ? (
            <ImportSuccess success={success} onReturn={() => { setOpen(false); reset(); }} />
          ) : preview && !isParsing && !previewMutation.isPending && (
            <AssignmentPreview preview={preview} gradeLevel={gradeLevel} stalePreview={stalePreview} onRepreview={() => void requestPreview(previewRows, 1)} onPageChange={(page) => void requestPreview(previewRows, page)} onConfirm={handleConfirm} isConfirming={confirmMutation.isPending} />
          )}
          {preview && !success && <p className="text-center text-sm text-muted-foreground">Preview complete. No teaching assignments have been changed.</p>}
        </div>
      </FormDialog>
    </>
  );
}

function AssignmentPreview({
  preview,
  gradeLevel,
  stalePreview,
  onRepreview,
  onPageChange,
  onConfirm,
  isConfirming,
}: {
  preview: AssignmentPreview;
  gradeLevel: GradeLevel;
  stalePreview: boolean;
  onRepreview: () => void;
  onPageChange: (page: number) => void;
  onConfirm: () => void;
  isConfirming: boolean;
}) {
  const readyCount = preview.counts.VALID;
  const blockedCount = preview.totalRows - readyCount - preview.counts.ALREADY_ASSIGNED - preview.counts.CHANGE;
  const confirmable = blockedCount === 0 && !stalePreview;

  return (
    <div className="min-h-0 space-y-4">
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-5">
        <span>Total: {preview.totalRows}</span>
        <span>Ready to assign: {readyCount}</span>
        <span>Teacher changes: {preview.counts.CHANGE}</span>
        <span>Already assigned: {preview.counts.ALREADY_ASSIGNED}</span>
        <span>Blocked/errors: {blockedCount}</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm">
        <div>
          <p className="font-medium">{preview.academicYear} · Grade {gradeLevel}</p>
          <p className="text-muted-foreground">{preview.totalRows} rows · {readyCount} new · {preview.counts.CHANGE} Teacher changes · {preview.counts.ALREADY_ASSIGNED} already assigned · {blockedCount} blocked</p>
        </div>
        <Button type="button" onClick={onConfirm} disabled={!confirmable || isConfirming}>{isConfirming && <Loader2 className="animate-spin" />}Confirm assignments</Button>
        {stalePreview ? (
          <div className="flex items-center gap-2 text-destructive"><span>Assignments changed since Preview.</span><Button type="button" size="sm" variant="outline" onClick={onRepreview}>Re-preview</Button></div>
        ) : confirmable ? <span className="text-muted-foreground">All changes will be applied as one transaction.</span> : <span className="text-destructive">{blockedCount} blocking row{blockedCount === 1 ? "" : "s"} must be corrected and previewed again before confirming.</span>}
      </div>
      <ScrollArea className="h-80 rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Row</TableHead><TableHead>Grade</TableHead><TableHead>Subject</TableHead><TableHead>Section</TableHead><TableHead>Term</TableHead><TableHead>Requested Teacher</TableHead><TableHead>Current Teacher</TableHead><TableHead>Classification</TableHead><TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.outcomes.map((outcome) => (
              <TableRow key={outcome.rowNumber}>
                <TableCell>{outcome.rowNumber}</TableCell><TableCell>{outcome.gradeLevel}</TableCell><TableCell>{outcome.subjectCode}</TableCell><TableCell>{outcome.section}</TableCell><TableCell>{outcome.term}</TableCell><TableCell>{outcome.requestedTeacher}</TableCell><TableCell>{outcome.currentTeacher}</TableCell><TableCell><Badge variant={outcome.classification === "VALID" || outcome.classification === "ALREADY_ASSIGNED" || outcome.classification === "CHANGE" ? "secondary" : outcome.classification === "PROTECTED" ? "outline" : "destructive"}>{previewLabels[outcome.classification]}</Badge></TableCell><TableCell>{outcome.issue ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      {preview.pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span>Page {preview.page} of {preview.pageCount}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={preview.page === 1} onClick={() => onPageChange(preview.page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={preview.page === preview.pageCount} onClick={() => onPageChange(preview.page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ImportSuccess({ success, onReturn }: { success: { batchId: string; createdCount: number; updatedCount: number; unchangedCount: number }; onReturn: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 rounded-md border p-6 text-center">
      <CheckCircle2 className="size-10 text-primary" />
      <div className="space-y-1">
        <h3 className="font-semibold">Teaching assignments updated</h3>
        <p className="text-sm text-muted-foreground">{success.createdCount} created · {success.updatedCount} updated · {success.unchangedCount} unchanged</p>
        <p className="text-xs text-muted-foreground">Batch reference: {success.batchId}</p>
      </div>
      <Button type="button" onClick={onReturn}>Return to Teaching Matrix</Button>
    </div>
  );
}
