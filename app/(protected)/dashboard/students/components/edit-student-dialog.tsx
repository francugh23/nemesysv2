"use client";

import { FormDialog } from "@/components/common/dialogs/form-dialog";

import type { StudentListItem } from "@/types/student";

import { StudentForm } from "./student-form";

interface StudentEditDialogProps {
  student: StudentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StudentEditDialog({
  student,
  open,
  onOpenChange,
}: StudentEditDialogProps) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Edit Student">
      <StudentForm student={student} onSuccess={() => onOpenChange(false)} />
    </FormDialog>
  );
}
