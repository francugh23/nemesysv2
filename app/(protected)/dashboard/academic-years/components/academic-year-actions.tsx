"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AcademicYearListItem } from "@/schemas";

interface AcademicYearActionsProps {
  academicYear: AcademicYearListItem;
  onView: (academicYear: AcademicYearListItem) => void;
  onEdit: (academicYear: AcademicYearListItem) => void;
  onActivate: (academicYear: AcademicYearListItem) => void;
  onLock: (academicYear: AcademicYearListItem) => void;
  onArchive: (academicYear: AcademicYearListItem) => void;
}

export function AcademicYearActions({
  academicYear,
  onView,
  onEdit,
  onActivate,
  onLock,
  onArchive,
}: AcademicYearActionsProps) {
  function action(handler: (value: AcademicYearListItem) => void) {
    return (event: React.MouseEvent) => {
      event.stopPropagation();
      handler(academicYear);
    };
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${academicYear.label}`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={action(onView)}>View</DropdownMenuItem>
        {academicYear.status === "DRAFT" && (
          <>
            <DropdownMenuItem onClick={action(onEdit)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={action(onActivate)}>
              Activate
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={action(onArchive)}
            >
              Archive
            </DropdownMenuItem>
          </>
        )}
        {academicYear.status === "ACTIVE" && (
          <DropdownMenuItem onClick={action(onLock)}>Lock</DropdownMenuItem>
        )}
        {academicYear.status === "LOCKED" && (
          <DropdownMenuItem
            className="text-destructive"
            onClick={action(onArchive)}
          >
            Archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
