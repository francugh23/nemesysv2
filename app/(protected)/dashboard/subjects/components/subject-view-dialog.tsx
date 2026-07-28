"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { displayValue } from "@/lib/format";
import type { SubjectListItem } from "@/schemas";

interface SubjectViewDialogProps {
  subject: SubjectListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubjectViewDialog({
  subject,
  open,
  onOpenChange,
}: SubjectViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Subject Details</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-5">
          <h2 className="font-mono text-xl font-bold">{subject.code}</h2>
          <p className="text-muted-foreground">{subject.description}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SubjectInfoItem label="Grade Level" value={subject.gradeLevel} />
          <SubjectInfoItem label="Track / Strand" value={subject.trackStrand} />
          <SubjectInfoItem
            label="Semester"
            value={
              subject.semester === "FIRST"
                ? "First"
                : subject.semester === "SECOND"
                  ? "Second"
                  : null
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubjectInfoItem({
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
