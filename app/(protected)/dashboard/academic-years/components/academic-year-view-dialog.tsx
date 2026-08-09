"use client";

import { LockKeyhole } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateOnly, formatDateTime } from "@/lib/format";
import type { AcademicYearListItem } from "@/schemas";

import { AcademicYearStatusBadge } from "./academic-year-status-badge";

export function AcademicYearViewDialog({
  academicYear,
  open,
  onOpenChange,
}: {
  academicYear: AcademicYearListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isReadOnly =
    academicYear.status === "LOCKED" || academicYear.status === "ARCHIVED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl!">
        <DialogHeader>
          <DialogTitle>Academic Year Details</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{academicYear.label}</h2>
            <AcademicYearStatusBadge status={academicYear.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDateOnly(academicYear.startDate)} to{" "}
            {formatDateOnly(academicYear.endDate)}
          </p>
        </div>

        {isReadOnly && (
          <div className="flex gap-3 rounded-lg border px-4 py-3 text-sm">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p>
              This academic year is {academicYear.status.toLowerCase()} and is
              read-only.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <InfoItem
            label="Start Date"
            value={formatDateOnly(academicYear.startDate)}
          />
          <InfoItem
            label="End Date"
            value={formatDateOnly(academicYear.endDate)}
          />
          <InfoItem label="Created At" value={formatDateTime(academicYear.createdAt)} />
          <InfoItem label="Updated At" value={formatDateTime(academicYear.updatedAt)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}
