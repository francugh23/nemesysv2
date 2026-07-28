"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { exportToExcel } from "@/lib/export";
import type { ExportDefinition } from "@/types/export";

interface ExportButtonProps<TData> {
  records?: TData[];
  getRecords?: () => TData[];
  definition: ExportDefinition<TData>;
}

export function ExportButton<TData>({
  records,
  getRecords,
  definition,
}: ExportButtonProps<TData>) {
  function handleExport() {
    const exportRecords = getRecords?.() ?? records ?? [];

    if (exportRecords.length === 0) {
      toast.error("No records available to export.");
      return;
    }

    try {
      exportToExcel(exportRecords, definition);
      toast.success(`${exportRecords.length} record${exportRecords.length === 1 ? "" : "s"} exported.`);
    } catch {
      toast.error("Unable to export records.");
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleExport}
      disabled={!getRecords && (records?.length ?? 0) === 0}
    >
      <Download />
      Export
    </Button>
  );
}
