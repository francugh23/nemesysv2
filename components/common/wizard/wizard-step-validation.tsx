"use client";

import type { ImportValidationResult } from "@/types/import";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WizardStepValidationProps {
  result: ImportValidationResult;
}

export function WizardStepValidation({ result }: WizardStepValidationProps) {
  const { errors } = result;

  if (errors.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center">
        <p className="font-semibold text-green-600">Validation Passed</p>

        <p className="text-sm text-muted-foreground">
          Your file is ready for import.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-destructive">Fix the issues before importing.</h3>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Row</TableHead>

              <TableHead>Field</TableHead>

              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {errors.map((error, index) => (
              <TableRow key={index}>
                <TableCell>{error.row}</TableCell>

                <TableCell>{error.field ?? "-"}</TableCell>

                <TableCell>{error.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
