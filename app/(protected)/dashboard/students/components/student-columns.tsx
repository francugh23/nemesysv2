"use client";

import { ColumnDef } from "@tanstack/react-table";
import { StudentActions } from "./student-actions";
import type { StudentListItem } from "@/types/student";
import { StatusBadge, GenderBadge } from "@/components/common/badges";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { formatDate, formatFullName } from "@/lib/format";

interface StudentColumnProps {
  onEdit: (student: StudentListItem) => void;
  onDelete: (student: StudentListItem) => void;
}

export function studentColumns({
  onEdit,
  onDelete,
}: StudentColumnProps): ColumnDef<StudentListItem>[] {
  return [
    {
      accessorKey: "lrn",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="LRN" />
      ),
    },

    {
      id: "name",
      accessorFn: (student) =>
        formatFullName(
          student.firstName,
          student.middleName,
          student.lastName,
        ),
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
    },

    {
      id: "gender",
      accessorKey: "gender",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Gender" />
      ),
      cell: ({ row }) => <GenderBadge gender={row.original.gender} />,
    },

    {
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "grade",
      accessorFn: (student) => student.currentSection?.gradeLevel ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Grade" />
      ),
      cell: ({ row }) => row.original.currentSection?.gradeLevel ?? "-",
    },

    {
      id: "currentSection",
      accessorFn: (student) => student.currentSection?.sectionName ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Current Section" />
      ),
      cell: ({ row }) => row.original.currentSection?.sectionName ?? "-",
    },

    {
      id: "createdAt",
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Created Date" />
      ),
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
    {
      id: "actions",
      enableSorting: false,

      cell: ({ row }) => {
        const student = row.original;
        return (
          <StudentActions
            student={student}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        );
      },
    },
  ];
}
