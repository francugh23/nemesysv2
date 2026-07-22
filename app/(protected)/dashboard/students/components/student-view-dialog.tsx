"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";

import { StudentInfoSection } from "./student-info-section";
import { StudentInfoItem } from "./student-info-item";

import type { Student } from "@/app/generated/prisma/client";

interface StudentViewDialogProps {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentViewDialog({
  student,
  open,
  onOpenChange,
}: StudentViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-6xl! max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Student Profile</DialogTitle>
        </DialogHeader>

        {/* Student Header */}
        <div className="rounded-lg border bg-muted/30 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {student.firstName} {student.middleName ?? ""}{" "}
                {student.lastName}
              </h2>

              <p className="text-sm text-muted-foreground">
                LRN: {student.lrn}
              </p>
            </div>

            <Badge>{student.status}</Badge>
          </div>
        </div>

        <div className="space-y-4">
          {/* Personal */}
          <StudentInfoSection title="Personal Information">
            <StudentInfoItem label="First Name" value={student.firstName} />

            <StudentInfoItem label="Middle Name" value={student.middleName} />

            <StudentInfoItem label="Last Name" value={student.lastName} />

            <StudentInfoItem label="Gender" value={student.gender} />

            <StudentInfoItem
              label="Birth Date"
              value={
                student.dateOfBirth
                  ? student.dateOfBirth.toLocaleDateString()
                  : null
              }
            />
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
              value={student.createdAt.toLocaleString()}
            />

            <StudentInfoItem
              label="Updated At"
              value={student.updatedAt.toLocaleString()}
            />
          </StudentInfoSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}