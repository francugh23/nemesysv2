"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import type { SubjectListItem } from "@/schemas";
import { SubjectActions } from "./subject-actions";

interface SubjectColumnProps {
  onEdit: (subject: SubjectListItem) => void;
  onArchive: (subject: SubjectListItem) => void;
}

export function subjectColumns({
  onEdit,
  onArchive,
}: SubjectColumnProps): ColumnDef<SubjectListItem>[] {
  return [
  {
    accessorKey: "code",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Code" />
    ),
  },
  {
    accessorKey: "description",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Description" />
    ),
  },
  {
    id: "schoolLevel",
    header: "Level",
    cell: ({ row }) => (
      <Badge variant="outline">
        {["7", "8", "9", "10"].includes(row.original.gradeLevel)
          ? "JHS"
          : "SHS"}
      </Badge>
    ),
  },
  {
    id: "gradeLevel",
    accessorKey: "gradeLevel",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Grade Level" />,
    cell: ({ row }) => `Grade ${row.original.gradeLevel}`,
  },
  {
    id: "usage",
    header: "Definition Usage",
    cell: ({ row }) => {
      const subject = row.original;
      const isShs = ["11", "12"].includes(subject.gradeLevel);

      if (!isShs) {
        return <span className="text-sm text-muted-foreground">Reusable JHS definition</span>;
      }

      return (
        <div className="flex flex-wrap gap-1">
          <Badge variant={subject.activeCurriculumCount > 0 ? "outline" : "secondary"}>
            {subject.activeCurriculumCount > 0
              ? `Used by ${subject.activeCurriculumCount} active Curriculum ${subject.activeCurriculumCount === 1 ? "entry" : "entries"}`
              : "No active Curriculum"}
          </Badge>
        </div>
      );
    },
  },
  {
    accessorKey: "trackStrand",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Track / Strand" />
    ),
    cell: ({ row }) => row.original.trackStrand ?? "-",
  },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <SubjectActions
          subject={row.original}
          onEdit={onEdit}
          onArchive={onArchive}
        />
      ),
    },
  ];
}
