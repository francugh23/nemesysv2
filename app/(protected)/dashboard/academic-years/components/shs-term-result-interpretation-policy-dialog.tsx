"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AcademicYearListItem } from "@/schemas";

import { ShsTermResultInterpretationPolicyManager } from "./shs-term-result-interpretation-policy-manager";

export function ShsTermResultInterpretationPolicyDialog({
  academicYear,
  open,
  onOpenChange,
}: {
  academicYear: AcademicYearListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[96vw] max-w-3xl! flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>SHS Result Interpretation Policy</DialogTitle>
          <DialogDescription>
            {academicYear.label}: review the school-approved interpretation of
            finalized SHS Term Results.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6 py-5">
            <ShsTermResultInterpretationPolicyManager
              academicYearId={academicYear.id}
              open={open}
              isActive={academicYear.status === "ACTIVE"}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
