"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { GenderBadge } from "@/components/common/badges";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import type { TeacherListItem } from "@/schemas";
import { formatDate } from "@/lib/format";
import { TeacherActions } from "./teacher-actions";

interface TeacherColumnProps {
  onEdit: (teacher: TeacherListItem) => void;
  onDeactivate: (teacher: TeacherListItem) => void;
}

export function teacherColumns({
  onEdit,
  onDeactivate,
}: TeacherColumnProps): ColumnDef<TeacherListItem>[] {
  return [
    {
      id: "employeeNumber",
      accessorFn: (teacher) => teacher.user.employeeNumber ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Employee No." />
      ),
      cell: ({ row }) => row.original.user.employeeNumber ?? "-",
    },
    {
      id: "lastName",
      accessorFn: (teacher) => teacher.user.lastName,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Name" />
      ),
    },
    {
      id: "firstName",
      accessorFn: (teacher) => teacher.user.firstName,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="First Name" />
      ),
    },
    {
      id: "middleName",
      accessorFn: (teacher) => teacher.user.middleName ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Middle Name" />
      ),
      cell: ({ row }) => row.original.user.middleName ?? "-",
    },
    {
      id: "gender",
      accessorFn: (teacher) => teacher.user.gender,
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
      id: "status",
      accessorFn: (teacher) => teacher.user.status,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Account Status" />
      ),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.user.status === "ACTIVE" ? "secondary" : "outline"
          }
        >
          {row.original.user.status === "ACTIVE" ? "Active" : "Inactive"}
        </Badge>
      ),
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
      cell: ({ row }) => (
        <TeacherActions
          teacher={row.original}
          onEdit={onEdit}
          onDeactivate={onDeactivate}
        />
      ),
    },
  ];
}
