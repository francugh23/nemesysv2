"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useResetUserPassword } from "@/hooks/user.hook";
import type { UserListItem } from "@/schemas";

interface ResetUserPasswordDialogProps {
  user: UserListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetUserPasswordDialog({
  user,
  open,
  onOpenChange,
}: ResetUserPasswordDialogProps) {
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const resetPassword = useResetUserPassword();

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && resetPassword.isPending) {
      return;
    }

    if (!nextOpen) {
      setTemporaryPassword(null);
      resetPassword.reset();
    }

    onOpenChange(nextOpen);
  }

  async function handleReset() {
    try {
      const result = await resetPassword.mutateAsync(user.id);

      if (result.error || !result.temporaryPassword) {
        toast.error(result.error ?? "The temporary password could not be displayed.");
        return;
      }

      setTemporaryPassword(result.temporaryPassword);
      resetPassword.reset();
      toast.success(result.success);
    } catch {
      toast.error("Unable to reset the password. Try again.");
    }
  }

  async function copyPassword() {
    if (!temporaryPassword) {
      return;
    }

    try {
      await navigator.clipboard.writeText(temporaryPassword);
      toast.success("Temporary password copied.");
    } catch {
      toast.error("Unable to copy the temporary password.");
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={temporaryPassword ? "Password Reset" : "Reset Password"}
      maxWidth="max-w-md!"
    >
      {temporaryPassword ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <Check className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="space-y-1">
              <p className="font-medium">Password reset successfully</p>
              <p className="text-sm text-muted-foreground">
                Share this temporary password securely. It will not be shown again after this dialog is closed.
              </p>
            </div>
          </div>
          <Field>
            <FieldLabel htmlFor="reset-user-temporary-password">Temporary Password</FieldLabel>
            <div className="flex gap-2">
              <Input id="reset-user-temporary-password" value={temporaryPassword} readOnly className="font-mono" />
              <Button type="button" variant="outline" onClick={() => void copyPassword()} aria-label="Copy temporary password">
                <Copy />
              </Button>
            </div>
          </Field>
          <Button type="button" onClick={() => handleOpenChange(false)}>Close</Button>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Reset the password for {user.firstName} {user.lastName}. They will be required to use a new temporary password on their next sign-in.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={resetPassword.isPending}>Cancel</Button>
            <Button type="button" onClick={() => void handleReset()} disabled={resetPassword.isPending}>
              {resetPassword.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </div>
        </div>
      )}
    </FormDialog>
  );
}
