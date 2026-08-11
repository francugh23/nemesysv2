"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  onApprove,
  canManageOfferings,
}: {
  onEdit: (offering: SubjectOfferingListItem) => void;
  onArchive: (offering: SubjectOfferingListItem) => void;
  onApprove: (offering: SubjectOfferingListItem) => void;
  canManageOfferings: boolean;
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
      id: "shsContext",
      header: "SSHS Context",
      cell: ({ row }) => {
        const context = row.original.shsContext;
        if (!context) return "-";
        return (
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">{context.classification.replaceAll("_", " ")}</Badge>
            <Badge variant={context.curriculumStatus === "SCHOOL_APPROVED" ? "default" : "secondary"}>
              {context.curriculumStatus === "SCHOOL_APPROVED" ? "School Approved" : "Provisional DepEd"}
            </Badge>
            {context.cluster && <Badge variant="outline">{context.cluster.name}</Badge>}
          </div>
        );
      },
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.academicYear.status === "ACTIVE" && (canManageOfferings || row.original.shsContext?.curriculumStatus === "PROVISIONAL_DEPED") ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Subject offering actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {canManageOfferings && row.original.shsContext?.curriculumStatus !== "SCHOOL_APPROVED" && <DropdownMenuItem onClick={() => onEdit(row.original)}>Edit</DropdownMenuItem>}
              {row.original.shsContext?.curriculumStatus === "PROVISIONAL_DEPED" && <DropdownMenuItem onClick={() => onApprove(row.original)}>Approve for school use</DropdownMenuItem>}
              {canManageOfferings && <DropdownMenuItem className="text-destructive" onClick={() => onArchive(row.original)}>
                Archive
              </DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];
}
