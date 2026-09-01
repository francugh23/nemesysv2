"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/common/dialogs/confirm-delete-dialog";
import { useDeactivateTeacher } from "@/hooks/teacher.hook";
import type { TeacherListItem } from "@/schemas";

interface DeactivateTeacherDialogProps {
  teacher: TeacherListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeactivateTeacherDialog({
  teacher,
  open,
  onOpenChange,
}: DeactivateTeacherDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const deactivateTeacher = useDeactivateTeacher();
  const employeeNumber = teacher.employeeNumber;
  const isConfirmed = Boolean(employeeNumber) && confirmation === employeeNumber;

  async function handleDeactivate() {
    if (!isConfirmed) return;

    const result = await deactivateTeacher.mutateAsync(teacher.id);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    setConfirmation("");
    onOpenChange(false);
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setConfirmation("");
        }

        onOpenChange(value);
      }}
      title="Deactivate Teacher"
      description="The teacher will be retained but excluded from new adviser and assignment selections. Linked account access is unchanged."
      confirmLabel="To confirm, type the employee number:"
      confirmValue={employeeNumber}
      itemLabel="Teacher"
       itemName={`${teacher.lastName}, ${teacher.firstName}${
         teacher.middleName ? ` ${teacher.middleName}` : ""
      }`}
      inputValue={confirmation}
      onInputChange={setConfirmation}
      canConfirm={isConfirmed}
       isDeleting={deactivateTeacher.isPending}
      actionLabel="Deactivate"
      processingLabel="Deactivating..."
      onConfirm={handleDeactivate}
    />
  );
}
