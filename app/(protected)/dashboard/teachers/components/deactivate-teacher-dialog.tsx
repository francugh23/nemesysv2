"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { deactivateTeacherAction } from "@/actions/teacher.action";
import { ConfirmDeleteDialog } from "@/components/common/dialogs/confirm-delete-dialog";
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
  const [isDeactivating, setIsDeactivating] = useState(false);
  const queryClient = useQueryClient();
  const employeeNumber = teacher.user.employeeNumber ?? "";
  const isConfirmed = Boolean(employeeNumber) && confirmation === employeeNumber;

  async function handleDeactivate() {
    if (!isConfirmed) return;

    setIsDeactivating(true);
    const result = await deactivateTeacherAction(teacher.id);

    if (result.error) {
      toast.error(result.error);
      setIsDeactivating(false);
      return;
    }

    toast.success(result.success);
    await queryClient.invalidateQueries({
      queryKey: ["teachers"],
    });
    setIsDeactivating(false);
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
      description="The teacher profile will be deactivated and the account will no longer be able to sign in."
      confirmLabel="To confirm, type the employee number:"
      confirmValue={employeeNumber}
      itemLabel="Teacher"
      itemName={`${teacher.user.lastName}, ${teacher.user.firstName}${
        teacher.user.middleName ? ` ${teacher.user.middleName}` : ""
      }`}
      inputValue={confirmation}
      onInputChange={setConfirmation}
      canConfirm={isConfirmed}
      isDeleting={isDeactivating}
      actionLabel="Deactivate"
      processingLabel="Deactivating..."
      onConfirm={handleDeactivate}
    />
  );
}
