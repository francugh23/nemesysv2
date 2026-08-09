"use client";

import type { AcademicYearListItem } from "@/schemas";

import { AcademicYearLifecycleDialog } from "./academic-year-lifecycle-dialog";
import { AcademicYearViewDialog } from "./academic-year-view-dialog";
import { EditAcademicYearDialog } from "./edit-academic-year-dialog";

export type AcademicYearDialogType =
  | "view"
  | "edit"
  | "activate"
  | "lock"
  | "archive"
  | null;

export function AcademicYearDialogManager({
  academicYear,
  dialog,
  instanceId,
  onClose,
}: {
  academicYear: AcademicYearListItem | null;
  dialog: AcademicYearDialogType;
  instanceId: number;
  onClose: (instanceId: number) => void;
}) {
  if (!academicYear) return null;

  const handleOpenChange = (open: boolean) => !open && onClose(instanceId);

  return (
    <>
      <AcademicYearViewDialog
        academicYear={academicYear}
        open={dialog === "view"}
        onOpenChange={handleOpenChange}
      />
      {academicYear.status === "DRAFT" && (
        <EditAcademicYearDialog
          academicYear={academicYear}
          open={dialog === "edit"}
          onOpenChange={handleOpenChange}
        />
      )}
      {(dialog === "activate" || dialog === "lock" || dialog === "archive") && (
        <AcademicYearLifecycleDialog
          academicYear={academicYear}
          action={dialog}
          open
          onOpenChange={handleOpenChange}
        />
      )}
    </>
  );
}
