"use client";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import type { SubjectAssignmentListItem } from "@/schemas";

import { EditSubjectAssignmentForm } from "./edit-subject-assignment-form";

interface EditSubjectAssignmentDialogProps {
  assignment: SubjectAssignmentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSubjectAssignmentDialog({
  assignment,
  open,
  onOpenChange,
}: EditSubjectAssignmentDialogProps) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Subject Assignment"
    >
      <EditSubjectAssignmentForm
        assignment={assignment}
        onSuccess={() => onOpenChange(false)}
      />
    </FormDialog>
  );
}
