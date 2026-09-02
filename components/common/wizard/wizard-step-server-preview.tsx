"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportServerPreview } from "@/types/import";

interface WizardStepServerPreviewProps {
  preview: ImportServerPreview | null;
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

const labels = {
  VALID: "Valid",
  DUPLICATE_IN_FILE: "Duplicate in file",
  EXISTING_ACTIVE: "Existing active",
  EXISTING_INACTIVE: "Existing inactive",
  EXISTING_ARCHIVED: "Existing archived",
  EMAIL_COLLISION: "Email collision",
  INVALID: "Invalid",
};

export function WizardStepServerPreview({
  preview,
  isLoading,
  onPageChange,
}: WizardStepServerPreviewProps) {
  if (isLoading) {
    return <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">Checking current Teacher records...</div>;
  }

  if (!preview) {
    return <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">Upload a structurally valid file to request the server preview.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <span>Total: {preview.totalRows}</span>
        {Object.entries(preview.counts).map(([classification, count]) => (
          <span key={classification}>{labels[classification as keyof typeof labels]}: {count}</span>
        ))}
        <span>Warnings: {preview.warningCount}</span>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Employee Number</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Issue</TableHead></TableRow></TableHeader>
          <TableBody>
            {preview.outcomes.map((outcome) => (
              <TableRow key={outcome.rowNumber}>
                <TableCell>{outcome.rowNumber}</TableCell><TableCell>{outcome.identity || "-"}</TableCell><TableCell>{outcome.name || "-"}</TableCell><TableCell>{labels[outcome.classification]}</TableCell><TableCell>{outcome.issue ?? "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {preview.pageCount > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span>Page {preview.page} of {preview.pageCount}</span>
          <div className="flex gap-2"><Button size="sm" variant="outline" disabled={preview.page === 1 || isLoading} onClick={() => onPageChange(preview.page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={preview.page === preview.pageCount || isLoading} onClick={() => onPageChange(preview.page + 1)}>Next</Button></div>
        </div>
      )}
    </div>
  );
}
