"use client";

import { toast } from "sonner";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";
import { useChangeUserStatus } from "@/hooks/user.hook";
import type { UserListItem } from "@/schemas";

interface ChangeUserStatusDialogProps {
  user: UserListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangeUserStatusDialog({ user, open, onOpenChange }: ChangeUserStatusDialogProps) {
  const changeStatus = useChangeUserStatus();
  const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const action = nextStatus === "ACTIVE" ? "Activate" : "Deactivate";

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && changeStatus.isPending) {
      return;
    }

    onOpenChange(nextOpen);
  }

  async function handleStatusChange() {
    try {
      const result = await changeStatus.mutateAsync({ id: user.id, status: nextStatus });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      onOpenChange(false);
    } catch {
      toast.error(`Unable to ${action.toLowerCase()} the user. Try again.`);
    }
  }

  return (
    <FormDialog open={open} onOpenChange={handleOpenChange} title={`${action} User`} maxWidth="max-w-md!">
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          {action} {user.firstName} {user.lastName}&apos;s account?
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={changeStatus.isPending}>Cancel</Button>
          <Button type="button" variant={nextStatus === "INACTIVE" ? "destructive" : "default"} onClick={() => void handleStatusChange()} disabled={changeStatus.isPending}>
            {changeStatus.isPending ? `${action}ing...` : action}
          </Button>
        </div>
      </div>
    </FormDialog>
  );
}
