"use client";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import type { SubjectListItem } from "@/schemas";

import { EditSubjectForm } from "./edit-subject-form";

interface EditSubjectDialogProps {
  subject: SubjectListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSubjectDialog({
  subject,
  open,
  onOpenChange,
}: EditSubjectDialogProps) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Edit Subject">
      <EditSubjectForm subject={subject} onSuccess={() => onOpenChange(false)} />
    </FormDialog>
  );
}
