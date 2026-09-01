"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GenderBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { displayValue, formatFullName } from "@/lib/format";
import type { TeacherListItem } from "@/schemas";

interface TeacherViewDialogProps {
  teacher: TeacherListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TeacherViewDialog({
  teacher,
  open,
  onOpenChange,
}: TeacherViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl! max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Teacher Profile</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-bold">
                {formatFullName(
                  teacher.firstName,
                  teacher.middleName,
                  teacher.lastName,
                )}
              </h2>
              <p className="font-mono text-sm font-medium">
                {teacher.employeeNumber}
              </p>
            </div>

            <Badge
               variant={teacher.status === "ACTIVE" ? "secondary" : "outline"}
            >
               {teacher.status === "ACTIVE" ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-3">
            <h3 className="font-semibold">Account</h3>
            <TeacherInfoItem label="Linked account" value={teacher.hasLinkedAccount ? "Yes" : "No"} />
            <TeacherInfoItem label="Email" value={teacher.email} />
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Personal Information</h3>
            <TeacherInfoItem label="First Name" value={teacher.firstName} />
            <TeacherInfoItem label="Middle Name" value={teacher.middleName} />
            <TeacherInfoItem label="Last Name" value={teacher.lastName} />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Gender</p>
              <GenderBadge gender={teacher.gender} />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Professional Information</h3>
            <TeacherInfoItem label="Degree" value={teacher.degree} />
            <TeacherInfoItem label="Major" value={teacher.major} />
            <TeacherInfoItem
              label="Adviser"
               value={teacher.activeAdvisedSectionCount ? `Yes (${teacher.activeAdvisedSectionCount})` : "No"}
             />
            <TeacherInfoItem label="Active assignments" value={String(teacher.activeSubjectAssignmentCount)} />
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TeacherInfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p>{displayValue(value)}</p>
    </div>
  );
}
