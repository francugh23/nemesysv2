"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl! max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
        </DialogHeader>

        <StudentForm student={student} onSuccess={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}