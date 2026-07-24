"use client";

import { useEffect, useState } from "react";

import * as XLSX from "xlsx";

import { normalizeStudentImportRow } from "@/lib/student-import-normalizer";
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
  onRowsLoaded: (rows: Record<string, unknown>[]) => void;
}

export function WizardStepPreview({ file, onRowsLoaded }: WizardStepPreviewProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!file) {
      setRows([]);
      return;
    }

    async function readFile() {
      if (!file) return;

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // Remove SheetJS internal metadata (__rowNum__) for Server Action compatibility.
      const data = XLSX.utils
        .sheet_to_json<Record<string, unknown>>(worksheet)
        .map((row) => normalizeStudentImportRow({ ...row }));
      const previewRows = data.slice(0, 10);
      setRows(previewRows);
      onRowsLoaded(data);
    }

    readFile();
  }, [file]);

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

  const headers = Object.keys(rows[0]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Preview</h3>

        <p className="text-sm text-muted-foreground">
          Showing first {rows.length} records.
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
            {rows.map((row, index) => (
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
