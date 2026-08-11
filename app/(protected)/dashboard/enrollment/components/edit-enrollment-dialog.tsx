"use client";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import type { EnrollmentListItem } from "@/schemas";

import { EditEnrollmentForm } from "./edit-enrollment-form";

interface EditEnrollmentDialogProps {
  enrollment: EnrollmentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditEnrollmentDialog({
  enrollment,
  open,
  onOpenChange,
}: EditEnrollmentDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Correct Enrollment Placement"
    >
      <EditEnrollmentForm
        enrollment={enrollment}
        onSuccess={() => onOpenChange(false)}
      />
    </FormDialog>
  );
}
