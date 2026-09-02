"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { WizardStepUpload } from "@/components/common/wizard/wizard-step-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useExportSubjectAssignments,
  usePreviewSubjectAssignmentImport,
  useSubjectAssignmentImportTemplate,
} from "@/hooks/subject-assignment.hook";
import { downloadExportFile } from "@/lib/export/download";
import { parseSpreadsheet } from "@/lib/import/spreadsheet";
import { normalizeSubjectAssignmentImportRow } from "@/lib/subject-assignment-import-normalizer";
import { validateSubjectAssignmentImport } from "@/lib/subject-assignment-import-validator";

const previewLabels = {
  VALID: "Valid",
  ALREADY_ASSIGNED: "Already assigned",
  CHANGE: "Change",
  PROTECTED: "Protected",
  TEACHER_NOT_FOUND: "Teacher not found",
  INACTIVE_TEACHER: "Inactive Teacher",
  ARCHIVED_TEACHER: "Archived Teacher",
  SECTION_NOT_FOUND: "Section not found",
  OFFERING_NOT_FOUND: "Offering not found",
  TERM_NOT_FOUND: "Term not found",
  TERM_NOT_APPLICABLE: "Term not applicable",
  GRADE_MISMATCH: "Grade mismatch",
  UNAPPROVED_SHS: "Unapproved SHS",
  DUPLICATE_IN_FILE: "Duplicate in file",
  AMBIGUOUS_SECTION: "Ambiguous Section",
  AMBIGUOUS_OFFERING: "Ambiguous Offering",
  AMBIGUOUS_TERM: "Ambiguous Term",
  INVALID: "Invalid",
} as const;

type GradeLevel = "7" | "8" | "9" | "10" | "11" | "12";
type PreviewClassification = keyof typeof previewLabels;
type AssignmentPreview = {
  academicYear: string;
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
  const previewMutation = usePreviewSubjectAssignmentImport();
  const exportMutation = useExportSubjectAssignments();
  const templateMutation = useSubjectAssignmentImportTemplate();
  const [isParsing, startParsing] = useTransition();

  function reset() {
    setFile(null);
    setPreviewRows([]);
    setPreview(null);
  }

  async function requestPreview(rows: Record<string, unknown>[], page: number) {
    const result = await previewMutation.mutateAsync({ rows, gradeLevel, page });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setPreview(result.preview as AssignmentPreview);
  }

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setPreviewRows([]);
    setPreview(null);
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

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={handleExport} disabled={exportMutation.isPending}>
          {exportMutation.isPending ? <Loader2 className="animate-spin" /> : <Download />}
          Export XLSX
        </Button>
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          <Upload />
          Preview assignment file
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
          <WizardStepUpload
            entityLabel="Teaching Assignment"
            file={file}
            onFileChange={handleFileChange}
            onTemplateDownload={handleTemplateDownload}
            isDownloadingTemplate={templateMutation.isPending}
          />
          {(isParsing || previewMutation.isPending) && (
            <div className="flex items-center justify-center gap-2 rounded-md border p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Resolving teaching assignment scopes...
            </div>
          )}
          {preview && !isParsing && !previewMutation.isPending && (
            <AssignmentPreview preview={preview} onPageChange={(page) => void requestPreview(previewRows, page)} />
          )}
          {preview && <p className="text-center text-sm text-muted-foreground">Preview complete. No teaching assignments have been changed.</p>}
        </div>
      </FormDialog>
    </>
  );
}

function AssignmentPreview({
  preview,
  onPageChange,
}: {
  preview: AssignmentPreview;
  onPageChange: (page: number) => void;
}) {
  const errors = preview.totalRows - preview.counts.VALID - preview.counts.ALREADY_ASSIGNED - preview.counts.CHANGE - preview.counts.PROTECTED;

  return (
    <div className="min-h-0 space-y-4">
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        <span>Total: {preview.totalRows}</span>
        <span>Valid: {preview.counts.VALID}</span>
        <span>Already assigned: {preview.counts.ALREADY_ASSIGNED}</span>
        <span>Changes: {preview.counts.CHANGE}</span>
        <span>Protected: {preview.counts.PROTECTED}</span>
        <span>Errors: {errors}</span>
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
