"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";

import { ConfirmDeleteDialog } from "@/components/common/dialogs/confirm-delete-dialog";

import type { StudentListItem } from "@/types/student";

import { deleteStudentAction } from "@/actions/student.action";

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
  const [isDeleting, setIsDeleting] = useState(false);

  const queryClient = useQueryClient();

  const isConfirmed = lrnInput === student.lrn;

  async function handleDelete() {
    if (!isConfirmed) return;

    setIsDeleting(true);

    const result = await deleteStudentAction(student.id);

    if (result.error) {
      toast.error(result.error);
      setIsDeleting(false);
      return;
    }

    toast.success(result.success);

    await queryClient.invalidateQueries({
      queryKey: ["students"],
    });

    setIsDeleting(false);
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
      isDeleting={isDeleting}
      onConfirm={handleDelete}
    />
  );
}
