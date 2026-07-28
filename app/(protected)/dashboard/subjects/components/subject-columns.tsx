"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import type { SubjectListItem } from "@/schemas";
import { SubjectActions } from "./subject-actions";

function formatSemester(semester: SubjectListItem["semester"]) {
  if (!semester) return "-";

  return semester === "FIRST" ? "First" : "Second";
}

interface SubjectColumnProps {
  onEdit: (subject: SubjectListItem) => void;
}

export function subjectColumns({
  onEdit,
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
    accessorKey: "gradeLevel",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Grade Level" />
    ),
  },
  {
    accessorKey: "trackStrand",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Track / Strand" />
    ),
    cell: ({ row }) => row.original.trackStrand ?? "-",
  },
  {
    accessorKey: "semester",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Semester" />
    ),
    cell: ({ row }) => formatSemester(row.original.semester),
  },
    {
      id: "actions",
      cell: ({ row }) => (
        <SubjectActions subject={row.original} onEdit={onEdit} />
      ),
    },
  ];
}
