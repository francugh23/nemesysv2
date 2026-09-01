"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TeacherListItem } from "@/schemas";

interface TeacherActionsProps {
  teacher: TeacherListItem;
  onEdit: (teacher: TeacherListItem) => void;
  onDeactivate: (teacher: TeacherListItem) => void;
  onArchive: (teacher: TeacherListItem) => void;
}

export function TeacherActions({
  teacher,
  onEdit,
  onDeactivate,
  onArchive,
}: TeacherActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />

      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onEdit(teacher);
          }}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onDeactivate(teacher);
          }}
        >
          {teacher.status === "ACTIVE" ? "Deactivate" : "Inactive"}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={(event) => { event.stopPropagation(); onArchive(teacher); }}>
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
