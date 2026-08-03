"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { UserListItem } from "@/schemas";

interface UserActionsProps {
  user: UserListItem;
  onEdit: (user: UserListItem) => void;
  onResetPassword: (user: UserListItem) => void;
  onChangeStatus: (user: UserListItem) => void;
  onChangeRole: (user: UserListItem) => void;
}

export function UserActions({
  user,
  onEdit,
  onResetPassword,
  onChangeStatus,
  onChangeRole,
}: UserActionsProps) {
  const isTeacher = user.isTeacherOwned || user.role === "TEACHER";
  const teacherHelpId = `teacher-edit-help-${user.id}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${user.firstName} ${user.lastName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={isTeacher}
          aria-describedby={isTeacher ? teacherHelpId : undefined}
          onClick={(event) => {
            event.stopPropagation();

            if (!isTeacher) {
              onEdit(user);
            }
          }}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isTeacher}
          aria-describedby={isTeacher ? teacherHelpId : undefined}
          onClick={(event) => {
            event.stopPropagation();

            if (!isTeacher) {
              onChangeRole(user);
            }
          }}
        >
          Change Role
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isTeacher}
          aria-describedby={isTeacher ? teacherHelpId : undefined}
          onClick={(event) => {
            event.stopPropagation();

            if (!isTeacher) {
              onChangeStatus(user);
            }
          }}
        >
          {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isTeacher}
          aria-describedby={isTeacher ? teacherHelpId : undefined}
          onClick={(event) => {
            event.stopPropagation();

            if (!isTeacher) {
              onResetPassword(user);
            }
          }}
        >
          Reset Password
        </DropdownMenuItem>
        {isTeacher && (
          <p
            id={teacherHelpId}
            className="max-w-48 px-1.5 py-1 text-xs text-muted-foreground"
          >
            Teacher accounts are managed through Teacher Management.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
