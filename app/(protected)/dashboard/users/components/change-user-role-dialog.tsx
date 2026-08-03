"use client";

import { useState } from "react";
import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useChangeUserRole } from "@/hooks/user.hook";
import type { UserListItem } from "@/schemas";

interface ChangeUserRoleDialogProps {
  user: UserListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeUserRoleDialog({ user, open, onOpenChange }: ChangeUserRoleDialogProps) {
  const [role, setRole] = useState<"SUPER_ADMIN" | "REGISTRAR" | "PRINCIPAL">(
    user.role as "SUPER_ADMIN" | "REGISTRAR" | "PRINCIPAL",
  );
  const changeRole = useChangeUserRole();

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && changeRole.isPending) {
      return;
    }

    onOpenChange(nextOpen);
  }

  async function handleRoleChange() {
    try {
      const result = await changeRole.mutateAsync({ id: user.id, role });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      onOpenChange(false);
    } catch {
      toast.error("Unable to update the user role. Try again.");
    }
  }

  return (
    <FormDialog open={open} onOpenChange={handleOpenChange} title="Change User Role" maxWidth="max-w-md!">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">Change the role for {user.firstName} {user.lastName}.</p>
        <Field>
          <FieldLabel htmlFor="change-user-role">Role</FieldLabel>
          <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
            <SelectTrigger id="change-user-role"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
              <SelectItem value="REGISTRAR">Registrar</SelectItem>
              <SelectItem value="PRINCIPAL">Principal</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={changeRole.isPending}>Cancel</Button>
          <Button type="button" onClick={() => void handleRoleChange()} disabled={changeRole.isPending || role === user.role}>
            {changeRole.isPending ? "Updating..." : "Update Role"}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
