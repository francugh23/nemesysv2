"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SubjectListItem } from "@/schemas";

interface SubjectActionsProps {
  subject: SubjectListItem;
  onEdit: (subject: SubjectListItem) => void;
  onArchive: (subject: SubjectListItem) => void;
}

export function SubjectActions({
  subject,
  onEdit,
  onArchive,
}: SubjectActionsProps) {
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
            onEdit(subject);
          }}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onArchive(subject);
          }}
        >
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
