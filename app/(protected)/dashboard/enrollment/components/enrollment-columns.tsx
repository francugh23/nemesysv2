"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { displayValue, formatFullName } from "@/lib/format";
import type { EnrollmentListItem } from "@/schemas";

import { EnrollmentActions } from "./enrollment-actions";

const statusVariants = {
  ACTIVE: "default",
  COMPLETED: "secondary",
  DROPPED: "destructive",
  TRANSFERRED: "outline",
} as const;

interface EnrollmentColumnOptions {
  onTransition: (
    enrollment: EnrollmentListItem,
    status: "COMPLETED" | "DROPPED" | "TRANSFERRED",
  ) => void;
}

export function enrollmentColumns({
  onTransition,
}: EnrollmentColumnOptions): ColumnDef<EnrollmentListItem>[] {
  return [
    {
      accessorKey: "studentLrn",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="LRN" />
      ),
    },
    {
      id: "studentName",
      accessorFn: (enrollment) => enrollment.studentLastName,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Student" />
      ),
      cell: ({ row }) =>
        formatFullName(
          row.original.studentFirstName,
          row.original.studentMiddleName,
          row.original.studentLastName,
        ),
    },
    {
      accessorKey: "sectionGradeLevel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Grade" />
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
        <DataTableColumnHeader column={column} title="Section" />
      ),
    },
    {
      accessorKey: "academicYear",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Academic Year" />
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <Badge variant={statusVariants[row.original.status]}>
          {row.original.status.charAt(0) +
            row.original.status.slice(1).toLowerCase()}
        </Badge>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <EnrollmentActions
          enrollment={row.original}
          onTransition={onTransition}
        />
      ),
    },
  ];
}
