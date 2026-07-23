"use client";

import { FormDialog } from "@/components/common/dialogs/form-dialog";

import type { Student } from "@/app/generated/prisma/client";

import { StudentForm } from "./student-form";

interface StudentEditDialogProps {
  student: Student;
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