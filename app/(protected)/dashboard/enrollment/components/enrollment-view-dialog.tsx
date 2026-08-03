"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { displayValue, formatDateTime, formatFullName } from "@/lib/format";
import type { EnrollmentListItem } from "@/schemas";

const statusVariants = {
  ACTIVE: "default",
  COMPLETED: "secondary",
  DROPPED: "destructive",
  TRANSFERRED: "outline",
} as const;

interface EnrollmentViewDialogProps {
  enrollment: EnrollmentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnrollmentViewDialog({
  enrollment,
  open,
  onOpenChange,
}: EnrollmentViewDialogProps) {
  const studentName = formatFullName(
    enrollment.studentFirstName,
    enrollment.studentMiddleName,
    enrollment.studentLastName,
  );
  const semester = enrollment.semester
    ? enrollment.semester.charAt(0) +
      enrollment.semester.slice(1).toLowerCase()
    : null;
  const status =
    enrollment.status.charAt(0) + enrollment.status.slice(1).toLowerCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Enrollment Details</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-5">
          <p className="text-sm font-medium text-muted-foreground">
            {enrollment.studentLrn}
          </p>
          <h2 className="text-xl font-bold">{studentName}</h2>
          <p className="text-muted-foreground">
            {enrollment.academicYear}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <EnrollmentInfoItem label="LRN" value={enrollment.studentLrn} />
          <EnrollmentInfoItem label="Student Name" value={studentName} />
          <EnrollmentInfoItem
            label="Grade Level"
            value={enrollment.sectionGradeLevel}
          />
          <EnrollmentInfoItem
            label="Track / Strand"
            value={enrollment.sectionTrackStrand}
          />
          <EnrollmentInfoItem label="Section" value={enrollment.sectionName} />
          <EnrollmentInfoItem
            label="Academic Year"
            value={enrollment.academicYear}
          />
          <EnrollmentInfoItem label="Semester" value={semester} />
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Enrollment Status
            </p>
            <Badge variant={statusVariants[enrollment.status]}>{status}</Badge>
          </div>
          <EnrollmentInfoItem
            label="Created At"
            value={formatDateTime(enrollment.createdAt)}
          />
          <EnrollmentInfoItem
            label="Updated At"
            value={formatDateTime(enrollment.updatedAt)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EnrollmentInfoItem({
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
