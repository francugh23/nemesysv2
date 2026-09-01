"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { StatusBadge, GenderBadge } from "@/components/common/badges";

import { StudentInfoSection } from "./student-info-section";
import { StudentInfoItem } from "./student-info-item";

import type { StudentListItem } from "@/types/student";

import { formatDate, formatFullName } from "@/lib/format";

interface StudentViewDialogProps {
  student: StudentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentViewDialog({
  student,
  open,
  onOpenChange,
}: StudentViewDialogProps) {
  const currentSection = student.currentSection;
  const adviser = currentSection?.adviser
    ? formatFullName(
        currentSection.adviser.firstName,
        currentSection.adviser.middleName,
        currentSection.adviser.lastName,
      )
    : null;
  const shift = currentSection?.shift
    ? currentSection.shift.charAt(0) +
      currentSection.shift.slice(1).toLowerCase()
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-5xl! max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Student Profile</DialogTitle>
        </DialogHeader>

        {/* Student Header */}
        <div className="rounded-lg border bg-muted/30 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold">
                {formatFullName(
                  student.firstName,
                  student.middleName,
                  student.lastName,
                )}
              </h2>

              <div>
                <p className="text-sm text-muted-foreground">
                  Learner Reference Number
                </p>

                <p className="font-mono text-sm font-medium">{student.lrn}</p>
              </div>
            </div>

            <StatusBadge status={student.status} />
          </div>
        </div>

        <div className="space-y-4">
          {/* Personal */}
          <StudentInfoSection title="Personal Information">
            <StudentInfoItem label="First Name" value={student.firstName} />

            <StudentInfoItem label="Middle Name" value={student.middleName} />

            <StudentInfoItem label="Last Name" value={student.lastName} />

            <div className="space-y-1">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">
                  Gender
                </p>

                <GenderBadge gender={student.gender} />
              </div>
            </div>

            <StudentInfoItem
              label="Birth Date"
              value={formatDate(student.dateOfBirth)}
            />
          </StudentInfoSection>

          <StudentInfoSection title="Current Placement">
            <StudentInfoItem
              label="Grade Level"
              value={currentSection?.gradeLevel}
            />
            <StudentInfoItem
              label="Section"
              value={currentSection?.sectionName}
            />
            <StudentInfoItem label="Shift" value={shift} />
            <StudentInfoItem label="Room" value={currentSection?.room} />
            <StudentInfoItem label="Adviser" value={adviser} />
          </StudentInfoSection>

          {/* Family */}
          <StudentInfoSection title="Family Information">
            <StudentInfoItem label="Father" value={student.fatherName} />

            <StudentInfoItem
              label="Father Contact"
              value={student.fatherContact}
            />

            <StudentInfoItem label="Mother" value={student.motherName} />

            <StudentInfoItem
              label="Mother Contact"
              value={student.motherContact}
            />

            <StudentInfoItem label="Guardian" value={student.guardianName} />

            <StudentInfoItem
              label="Guardian Contact"
              value={student.guardianContact}
            />
          </StudentInfoSection>

          {/* Address */}
          <StudentInfoSection title="Address Information">
            <StudentInfoItem label="Purok" value={student.purok} />

            <StudentInfoItem label="Barangay" value={student.barangay} />

            <StudentInfoItem
              label="Municipality"
              value={student.municipality}
            />

            <StudentInfoItem label="Province" value={student.province} />

            <StudentInfoItem label="Zip Code" value={student.zipCode} />
          </StudentInfoSection>

          {/* System */}
          <StudentInfoSection title="System Information">
            <StudentInfoItem
              label="Created At"
              value={formatDate(student.createdAt)}
            />

            <StudentInfoItem label="Updated At" value={formatDate(student.updatedAt)} />
          </StudentInfoSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}
