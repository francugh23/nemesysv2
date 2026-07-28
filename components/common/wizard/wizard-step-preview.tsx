"use client";

import { ScrollArea } from "@/components/ui/scroll-area";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WizardStepPreviewProps {
  file: File | null;
  rows: Record<string, unknown>[];
}

export function WizardStepPreview({ file, rows }: WizardStepPreviewProps) {

  if (!file) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        No file selected.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
        No records found.
      </div>
    );
  }

  const previewRows = rows.slice(0, 10);
  const headers = Object.keys(previewRows[0]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Preview</h3>

        <p className="text-sm text-muted-foreground">
          Showing first {previewRows.length} records.
        </p>
      </div>

      <ScrollArea className="h-80 w-full rounded-md border">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {previewRows.map((row, index) => (
              <TableRow key={index}>
                {headers.map((header) => (
                  <TableCell key={header}>
                    {String(row[header] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
}
