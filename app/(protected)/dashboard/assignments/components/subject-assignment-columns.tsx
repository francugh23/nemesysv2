"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { displayValue, formatFullName } from "@/lib/format";
import type { SubjectAssignmentListItem } from "@/schemas";

export const subjectAssignmentColumns: ColumnDef<SubjectAssignmentListItem>[] = [
  {
    accessorKey: "employeeNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Employee Number" />
    ),
    cell: ({ row }) => displayValue(row.original.employeeNumber),
  },
  {
    accessorKey: "teacherLastName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Teacher" />
    ),
    cell: ({ row }) =>
      formatFullName(
        row.original.teacherFirstName,
        row.original.teacherMiddleName,
        row.original.teacherLastName,
      ),
  },
  {
    accessorKey: "subjectCode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Subject Code" />
    ),
  },
  {
    accessorKey: "subjectDescription",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Subject Description" />
    ),
  },
  {
    accessorKey: "sectionGradeLevel",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Grade Level" />
    ),
  },
  {
    accessorKey: "sectionTrackStrand",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Track / Strand" />
    ),
    cell: ({ row }) => displayValue(row.original.sectionTrackStrand),
  },
  {
    accessorKey: "sectionName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Section Name" />
    ),
  },
  {
    accessorKey: "academicYear",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Academic Year" />
    ),
  },
];
