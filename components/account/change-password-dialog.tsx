"use client";

import { useState } from "react";

import { ChangePasswordForm } from "@/components/account/change-password-form";
import { FormDialog } from "@/components/common/dialogs/form-dialog";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const [isPending, setIsPending] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && isPending) {
      return;
    }

    onOpenChange(nextOpen);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Change Password"
      maxWidth="max-w-md!"
    >
      <ChangePasswordForm
        onCancel={() => handleOpenChange(false)}
        onPendingChange={setIsPending}
      />
    </FormDialog>
  );
}
