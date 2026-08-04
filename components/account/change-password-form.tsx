"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signOut } from "next-auth/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useChangeOwnPassword } from "@/hooks/account.hook";
import {
  ChangeOwnPasswordSchema,
  type ChangeOwnPasswordInput,
} from "@/schemas";
import { INVALID_SESSION_ROUTE } from "@/routes";

interface ChangePasswordFormProps {
  firstLogin?: boolean;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
}

export function ChangePasswordForm({
  firstLogin = false,
  onCancel,
  onPendingChange,
}: ChangePasswordFormProps) {
  const changePassword = useChangeOwnPassword();
  const form = useForm<ChangeOwnPasswordInput>({
    resolver: zodResolver(ChangeOwnPasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: ChangeOwnPasswordInput) {
    onPendingChange?.(true);

    try {
      const result = await changePassword.mutateAsync(values);

      if (result.sessionInvalid) {
        window.location.assign(INVALID_SESSION_ROUTE);
        return;
      }

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      await signOut({ redirectTo: "/auth/login" });
    } catch {
      toast.error("Unable to change your password. Try again.");
    } finally {
      onPendingChange?.(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {firstLogin
          ? "Replace your temporary password before continuing."
          : "Confirm your current password before choosing a replacement."}
      </p>

      <Field data-invalid={!!form.formState.errors.currentPassword}>
        <FieldLabel htmlFor="account-current-password">
          {firstLogin ? "Temporary Password" : "Current Password"}
        </FieldLabel>
        <Input
          id="account-current-password"
          type="password"
          autoComplete="current-password"
          disabled={changePassword.isPending}
          aria-invalid={!!form.formState.errors.currentPassword}
          aria-describedby="account-current-password-error"
          {...form.register("currentPassword")}
        />
        <FieldError id="account-current-password-error">
          {form.formState.errors.currentPassword?.message}
        </FieldError>
      </Field>

      <Field data-invalid={!!form.formState.errors.newPassword}>
        <FieldLabel htmlFor="account-new-password">New Password</FieldLabel>
        <Input
          id="account-new-password"
          type="password"
          autoComplete="new-password"
          disabled={changePassword.isPending}
          aria-invalid={!!form.formState.errors.newPassword}
          aria-describedby="account-new-password-help account-new-password-error"
          {...form.register("newPassword")}
        />
        <p
          id="account-new-password-help"
          className="text-xs text-muted-foreground"
        >
          Use 6 to 64 characters. Spaces and Unicode are allowed.
        </p>
        <FieldError id="account-new-password-error">
          {form.formState.errors.newPassword?.message}
        </FieldError>
      </Field>

      <Field data-invalid={!!form.formState.errors.confirmPassword}>
        <FieldLabel htmlFor="account-confirm-password">
          Confirm New Password
        </FieldLabel>
        <Input
          id="account-confirm-password"
          type="password"
          autoComplete="new-password"
          disabled={changePassword.isPending}
          aria-invalid={!!form.formState.errors.confirmPassword}
          aria-describedby="account-confirm-password-error"
          {...form.register("confirmPassword")}
        />
        <FieldError id="account-confirm-password-error">
          {form.formState.errors.confirmPassword?.message}
        </FieldError>
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            disabled={changePassword.isPending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={changePassword.isPending}>
          {changePassword.isPending ? "Changing..." : "Change Password"}
        </Button>
      </div>
    </form>
  );
}
