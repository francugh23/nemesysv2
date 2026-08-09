"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/common/dialogs/confirm-delete-dialog";

import type { StudentListItem } from "@/types/student";

import { useDeleteStudent } from "@/hooks/student.hook";

interface DeleteStudentDialogProps {
  student: StudentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteStudentDialog({
  student,
  open,
  onOpenChange,
}: DeleteStudentDialogProps) {
  const [lrnInput, setLrnInput] = useState("");
  const deleteStudent = useDeleteStudent();

  const isConfirmed = lrnInput === student.lrn;

  async function handleDelete() {
    if (!isConfirmed) return;

    const result = await deleteStudent.mutateAsync(student.id);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    setLrnInput("");

    onOpenChange(false);
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setLrnInput("");
        }

        onOpenChange(value);
      }}
      title="Delete Student"
      description="This action cannot be undone."
      confirmLabel="To confirm, type the LRN:"
      confirmValue={student.lrn}
      itemLabel="Student"
      itemName={`${student.lastName}, ${student.firstName}${
        student.middleName ? ` ${student.middleName}` : ""
      }`}
       inputValue={lrnInput}
       onInputChange={setLrnInput}
       isDeleting={deleteStudent.isPending}
      onConfirm={handleDelete}
    />
  );
}
