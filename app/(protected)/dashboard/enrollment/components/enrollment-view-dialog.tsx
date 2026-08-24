"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AcademicTermBadge } from "@/components/common/badges";
import { displayValue, formatDateTime, formatFullName } from "@/lib/format";
import type { EnrollmentListItem } from "@/schemas";

import { StudentSubjectEnrollmentList } from "./student-subject-enrollment-list";
import { ShsCurrentTermSubjectSelection } from "./shs-current-term-subject-selection";
import { StudentEnrollmentCorrectionHistory } from "./student-enrollment-correction-history";

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
  canViewPlacementCorrections: boolean;
  onCorrectPlacement?: () => void;
}

export function EnrollmentViewDialog({
  enrollment,
  open,
  onOpenChange,
  canViewPlacementCorrections,
  onCorrectPlacement,
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
      <DialogContent className="flex max-h-[92dvh] w-[96vw] max-w-5xl! flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
          <DialogTitle>Enrollment Details</DialogTitle>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-4 py-5 sm:px-6">
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

        {onCorrectPlacement ? (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/20">
          <div>
            <h3 className="font-semibold">Administrative Placement</h3>
            <p className="text-sm text-muted-foreground">
              Same-grade correction preserves participation and results. A
              regular-JHS grade-level correction preserves the old derived
              participation as history and creates replacement participation
              for the corrected grade.
            </p>
          </div>
          <Button
            onClick={onCorrectPlacement}
            disabled={enrollment.status !== "ACTIVE" || enrollment.academicYearStatus !== "ACTIVE"}
          >
            Correct Placement
          </Button>
          </div>
        ) : null}

        {canViewPlacementCorrections ? (
          <StudentEnrollmentCorrectionHistory enrollmentId={enrollment.id} open={open} />
        ) : null}

        <StudentSubjectEnrollmentList
          enrollmentId={enrollment.id}
          gradeLevel={enrollment.sectionGradeLevel}
          enrollmentStatus={enrollment.status}
          academicYearStatus={enrollment.academicYearStatus}
          open={open}
        />
        {open && (
          <ShsCurrentTermSubjectSelection
            enrollmentId={enrollment.id}
            gradeLevel={enrollment.sectionGradeLevel}
            enrollmentStatus={enrollment.status}
            academicYearStatus={enrollment.academicYearStatus}
            open
          />
        )}
          </div>
        </ScrollArea>
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
