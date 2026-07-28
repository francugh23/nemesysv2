"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { GenderBadge } from "@/components/common/badges";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import type { TeacherListItem } from "@/schemas";
import { TeacherActions } from "./teacher-actions";

interface TeacherColumnProps {
  onEdit: (teacher: TeacherListItem) => void;
}

export function teacherColumns({
  onEdit,
}: TeacherColumnProps): ColumnDef<TeacherListItem>[] {
  return [
  {
    accessorKey: "user.employeeNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Employee No." />
    ),
    cell: ({ row }) => row.original.user.employeeNumber ?? "-",
  },
  {
    accessorKey: "user.lastName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last Name" />
    ),
  },
  {
    accessorKey: "user.firstName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="First Name" />
    ),
  },
  {
    accessorKey: "user.middleName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Middle Name" />
    ),
    cell: ({ row }) => row.original.user.middleName ?? "-",
  },
  {
    accessorKey: "user.gender",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Gender" />
    ),
    cell: ({ row }) => <GenderBadge gender={row.original.user.gender} />,
  },
  {
    accessorKey: "degree",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Degree" />
    ),
    cell: ({ row }) => row.original.degree ?? "-",
  },
  {
    accessorKey: "major",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Major" />
    ),
    cell: ({ row }) => row.original.major ?? "-",
  },
  {
    accessorKey: "isAdviser",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Adviser" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {row.original.isAdviser ? "Yes" : "No"}
      </Badge>
    ),
  },
  {
    accessorKey: "user.status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Account Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.user.status === "ACTIVE" ? "secondary" : "outline"}>
        {row.original.user.status === "ACTIVE" ? "Active" : "Inactive"}
      </Badge>
    ),
  },
    {
      id: "actions",
      cell: ({ row }) => (
        <TeacherActions teacher={row.original} onEdit={onEdit} />
      ),
    },
  ];
}
