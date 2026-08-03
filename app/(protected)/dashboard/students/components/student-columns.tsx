"use client";

import { ColumnDef } from "@tanstack/react-table";
import { StudentActions } from "./student-actions";
import type { StudentListItem } from "@/types/student";
import { StatusBadge, GenderBadge } from "@/components/common/badges";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";

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
      id: "lastName",
      accessorKey: "lastName",

      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Name" />
      ),
    },

    {
      accessorKey: "firstName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="First Name" />
      ),
    },

    {
      accessorKey: "middleName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Middle Name" />
      ),
      cell: ({ row }) => row.original.middleName ?? "-",
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
      id: "gradeLevel",
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
      id: "status",
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",

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
