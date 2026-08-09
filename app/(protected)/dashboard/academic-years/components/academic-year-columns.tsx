"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { formatDateOnly, formatDateTime } from "@/lib/format";
import type { AcademicYearListItem } from "@/schemas";

import { AcademicYearActions } from "./academic-year-actions";
import { AcademicYearStatusBadge } from "./academic-year-status-badge";

interface AcademicYearColumnOptions {
  onView: (academicYear: AcademicYearListItem) => void;
  onEdit: (academicYear: AcademicYearListItem) => void;
  onActivate: (academicYear: AcademicYearListItem) => void;
  onLock: (academicYear: AcademicYearListItem) => void;
  onArchive: (academicYear: AcademicYearListItem) => void;
}

export function academicYearColumns(
  options: AcademicYearColumnOptions,
): ColumnDef<AcademicYearListItem>[] {
  return [
    {
      accessorKey: "label",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Academic Year" />
      ),
      cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
    },
    {
      accessorKey: "startDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Start Date" />
      ),
      cell: ({ row }) => formatDateOnly(row.original.startDate),
    },
    {
      accessorKey: "endDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="End Date" />
      ),
      cell: ({ row }) => formatDateOnly(row.original.endDate),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => (
        <AcademicYearStatusBadge status={row.original.status} />
      ),
    },
    {
      id: "updatedAt",
      accessorKey: "updatedAt",
      enableSorting: false,
      header: "Last Updated",
      cell: ({ row }) => formatDateTime(row.original.updatedAt),
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <AcademicYearActions academicYear={row.original} {...options} />
      ),
    },
  ];
}
