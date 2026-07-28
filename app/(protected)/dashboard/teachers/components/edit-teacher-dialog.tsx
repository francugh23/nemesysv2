"use client";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import type { TeacherListItem } from "@/schemas";

import { TeacherEditForm } from "./teacher-edit-form";

interface TeacherEditDialogProps {
  teacher: TeacherListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TeacherEditDialog({
  teacher,
  open,
  onOpenChange,
}: TeacherEditDialogProps) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Edit Teacher">
      <TeacherEditForm teacher={teacher} onSuccess={() => onOpenChange(false)} />
    </FormDialog>
  );
}
