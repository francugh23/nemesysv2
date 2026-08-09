"use client";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import type { AcademicYearListItem } from "@/schemas";

import { EditAcademicYearForm } from "./edit-academic-year-form";

export function EditAcademicYearDialog({
  academicYear,
  open,
  onOpenChange,
}: {
  academicYear: AcademicYearListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Academic Year"
      maxWidth="max-w-xl!"
    >
      <EditAcademicYearForm
        academicYear={academicYear}
        onSuccess={() => onOpenChange(false)}
      />
    </FormDialog>
  );
}
