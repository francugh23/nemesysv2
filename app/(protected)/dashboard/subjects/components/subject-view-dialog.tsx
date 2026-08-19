"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { displayValue } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
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
          <SubjectInfoItem
            label="School Level"
            value={["7", "8", "9", "10"].includes(subject.gradeLevel) ? "JHS" : "SHS"}
          />
          <SubjectInfoItem label="Grade Level" value={subject.gradeLevel} />
          <SubjectInfoItem label="Track / Strand" value={subject.trackStrand} />
        </div>

        {["11", "12"].includes(subject.gradeLevel) && (
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">Definition usage</p>
            <div className="flex flex-wrap gap-2">
              {subject.hasDepEdReference && <Badge variant="secondary">DepEd reference available</Badge>}
              <Badge variant="outline">
                {subject.activeCurriculumCount > 0
                  ? `Used by ${subject.activeCurriculumCount} active Curriculum ${subject.activeCurriculumCount === 1 ? "entry" : "entries"}`
                  : "No active Curriculum"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Core, Academic Elective, and TechPro Elective classification belongs to each Subject Offering, not this definition.
            </p>
          </div>
        )}
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
