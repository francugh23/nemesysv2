"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/lib/export";
import type { ExportDefinition } from "@/types/export";

interface ExportButtonProps<TData> {
  records: TData[];
  definition: ExportDefinition<TData>;
}

export function ExportButton<TData>({
  records,
  definition,
}: ExportButtonProps<TData>) {
  function handleExport() {
    try {
      exportToExcel(records, definition);
      toast.success(`${records.length} record${records.length === 1 ? "" : "s"} exported.`);
    } catch {
      toast.error("Unable to export records.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={records.length === 0}
    >
      <Download />
      Export
    </Button>
  );
}
