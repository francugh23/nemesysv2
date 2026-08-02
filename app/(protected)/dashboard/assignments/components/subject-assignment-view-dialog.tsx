"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { displayValue, formatFullName } from "@/lib/format";
import type { SubjectAssignmentListItem } from "@/schemas";

interface SubjectAssignmentViewDialogProps {
  assignment: SubjectAssignmentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubjectAssignmentViewDialog({
  assignment,
  open,
  onOpenChange,
}: SubjectAssignmentViewDialogProps) {
  const teacherName = formatFullName(
    assignment.teacherFirstName,
    assignment.teacherMiddleName,
    assignment.teacherLastName,
  );
  const section = `Grade ${assignment.sectionGradeLevel}${assignment.sectionTrackStrand ? ` - ${assignment.sectionTrackStrand}` : ""} - ${assignment.sectionName}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Subject Assignment Details</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-5">
          <p className="text-sm font-medium text-muted-foreground">
            {assignment.subjectCode}
          </p>
          <h2 className="text-xl font-bold">
            {assignment.subjectDescription}
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SubjectAssignmentInfoItem label="Teacher" value={teacherName} />
          <SubjectAssignmentInfoItem
            label="Employee Number"
            value={assignment.employeeNumber}
          />
          <SubjectAssignmentInfoItem label="Section" value={section} />
          <SubjectAssignmentInfoItem
            label="Academic Year"
            value={assignment.academicYear}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubjectAssignmentInfoItem({
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
