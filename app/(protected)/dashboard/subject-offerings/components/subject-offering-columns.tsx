"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { SubjectOfferingListItem } from "./subject-offering-types";

export function subjectOfferingColumns({
  onEdit,
  onArchive,
}: {
  onEdit: (offering: SubjectOfferingListItem) => void;
  onArchive: (offering: SubjectOfferingListItem) => void;
}): ColumnDef<SubjectOfferingListItem>[] {
  return [
    {
      accessorKey: "subjectCode",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Subject Code" />,
    },
    {
      accessorKey: "subjectDescription",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Subject Description" />,
    },
    {
      accessorKey: "gradeLevel",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Grade Level" />,
      cell: ({ row }) => `Grade ${row.original.gradeLevel}`,
    },
    {
      id: "academicYear",
      accessorFn: (row) => row.academicYear.label,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Academic Year" />,
    },
    {
      id: "terms",
      header: "Terms",
      cell: ({ row }) => row.original.terms.map((term) => term.academicTerm.name).join(", "),
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.academicYear.status === "ACTIVE" ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Subject offering actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(row.original)}>Edit</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => onArchive(row.original)}>
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];
}
