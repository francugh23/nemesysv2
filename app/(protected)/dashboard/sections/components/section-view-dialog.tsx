"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { displayValue, formatFullName } from "@/lib/format";
import type { SectionListItem } from "@/schemas";

interface SectionViewDialogProps {
  section: SectionListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SectionViewDialog({
  section,
  open,
  onOpenChange,
}: SectionViewDialogProps) {
  const adviser =
    section.adviserFirstName && section.adviserLastName
      ? formatFullName(
          section.adviserFirstName,
          section.adviserMiddleName,
          section.adviserLastName,
        )
      : null;
  const shift = section.shift
    ? section.shift.charAt(0) + section.shift.slice(1).toLowerCase()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Section Details</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-5">
          <p className="text-sm font-medium text-muted-foreground">
            Grade {section.gradeLevel}
          </p>
          <h2 className="text-xl font-bold">{section.sectionName}</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SectionInfoItem label="Grade Level" value={section.gradeLevel} />
          <SectionInfoItem label="Adviser" value={adviser} />
          <SectionInfoItem label="Room" value={section.room} />
          <SectionInfoItem label="Shift" value={shift} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionInfoItem({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p>{displayValue(value)}</p>
    </div>
  );
}
