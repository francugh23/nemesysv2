"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SectionListItem } from "@/schemas";

interface SectionActionsProps {
  section: SectionListItem;
  onEdit: (section: SectionListItem) => void;
  onArchive: (section: SectionListItem) => void;
}

export function SectionActions({
  section,
  onEdit,
  onArchive,
}: SectionActionsProps) {
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
            onEdit(section);
          }}
        >
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={(event) => {
            event.stopPropagation();
            onArchive(section);
          }}
        >
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
