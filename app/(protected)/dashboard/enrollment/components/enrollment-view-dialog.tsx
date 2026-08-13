"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AcademicTermBadge } from "@/components/common/badges";
import { displayValue, formatDateTime, formatFullName } from "@/lib/format";
import type { EnrollmentListItem } from "@/schemas";

import { StudentSubjectEnrollmentList } from "./student-subject-enrollment-list";
import { ShsCurriculumSelection } from "./shs-curriculum-selection";

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
  const status =
    enrollment.status.charAt(0) + enrollment.status.slice(1).toLowerCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-5xl! overflow-y-auto">
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
            label="Section Track / Strand"
            value={enrollment.sectionTrackStrand}
          />
          <EnrollmentInfoItem
            label="SHS Track"
            value={
              enrollment.shsTrack === "TECHPRO"
                ? "TechPro"
                : enrollment.shsTrack === "ACADEMIC"
                  ? "Academic"
                  : null
            }
          />
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Entry Academic Term
            </p>
            {enrollment.entryAcademicTermPosition ? (
              <AcademicTermBadge
                position={enrollment.entryAcademicTermPosition}
                name={enrollment.entryAcademicTermName ?? undefined}
              />
            ) : (
              <p>{displayValue(null)}</p>
            )}
          </div>
          <EnrollmentInfoItem label="Section" value={enrollment.sectionName} />
          <EnrollmentInfoItem
            label="Academic Year"
            value={enrollment.academicYear}
          />
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

        <StudentSubjectEnrollmentList
          key={enrollment.id}
          enrollmentId={enrollment.id}
          open={open}
        />
        <ShsCurriculumSelection
          enrollmentId={enrollment.id}
          gradeLevel={enrollment.sectionGradeLevel}
          enrollmentStatus={enrollment.status}
          academicYearStatus={enrollment.academicYearStatus}
          open={open}
        />
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
