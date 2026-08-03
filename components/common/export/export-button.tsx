"use client";

import { useTransition } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { downloadExportFile } from "@/lib/export/download";
import type {
  ExportActionResult,
  ExportFormat,
} from "@/types/export";

interface ExportButtonProps {
  exportAction: (format: ExportFormat) => Promise<ExportActionResult>;
  disabled?: boolean;
}

export function ExportButton({ exportAction, disabled }: ExportButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleExport(format: ExportFormat) {
    startTransition(async () => {
      try {
        const result = await exportAction(format);

        if ("error" in result) {
          toast.error(result.error);
          return;
        }

        downloadExportFile(result.file);
        toast.success(
          `${result.file.rowCount.toLocaleString("en-US")} record${result.file.rowCount === 1 ? "" : "s"} exported.`,
        );
      } catch {
        toast.error("Unable to export records.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled || isPending}
          >
            {isPending ? <Loader2 className="animate-spin" /> : <Download />}
            {isPending ? "Exporting..." : "Export"}
            <ChevronDown />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("csv")}>
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
          Export as XLSX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
