"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { StudentListItem } from "@/types/student";
interface StudentActionsProps {
  student: StudentListItem;
  onEdit: (student: StudentListItem) => void;
  onDelete: (student: StudentListItem) => void;
}

export function StudentActions({
  student,
  onEdit,
  onDelete,
}: StudentActionsProps) {
  return (
    <>
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
              onEdit(student);
            }}
          >
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem
            className="text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(student);
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
