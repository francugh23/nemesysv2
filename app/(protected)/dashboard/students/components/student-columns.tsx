"use client";

import { ColumnDef } from "@tanstack/react-table";
import { StudentActions } from "./student-actions";
import { Student } from "@/app/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { StatusBadge, GenderBadge } from "@/components/common/badges";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";

interface StudentColumnProps {
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
}

export function studentColumns({
  onEdit,
  onDelete,
}: StudentColumnProps): ColumnDef<Student>[] {
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
