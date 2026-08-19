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

import { ShsElectiveEnrollmentPolicyManager } from "./shs-elective-enrollment-policy-manager";

export function ShsElectiveEnrollmentPolicyDialog({
  academicYear,
  open,
  onOpenChange,
}: {
  academicYear: AcademicYearListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const readOnly =
    academicYear.status === "LOCKED" || academicYear.status === "ARCHIVED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-4xl! flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>SHS Elective Policies</DialogTitle>
          <DialogDescription>
            {academicYear.label}: configure how many Academic and TechPro
            electives students may select for each Term and SHS grade.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6 py-5">
            <ShsElectiveEnrollmentPolicyManager
              academicYearId={academicYear.id}
              open={open}
              readOnly={readOnly}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
