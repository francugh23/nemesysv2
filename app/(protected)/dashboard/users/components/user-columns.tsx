"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { RoleBadge } from "@/components/common/badges";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { displayValue, formatDate, formatFullName } from "@/lib/format";
import type { UserListItem } from "@/schemas";

export const userColumns: ColumnDef<UserListItem>[] = [
  {
    accessorKey: "employeeNumber",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Employee No." />
    ),
    cell: ({ row }) => displayValue(row.original.employeeNumber),
  },
  {
    accessorKey: "username",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Username" />
    ),
  },
  {
    id: "name",
    accessorFn: (user) => user.lastName,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) =>
      formatFullName(
        row.original.firstName,
        row.original.middleName,
        row.original.lastName,
      ),
  },
  {
    accessorKey: "email",
    enableSorting: false,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
  },
  {
    accessorKey: "role",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => <RoleBadge role={row.original.role} />,
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.status === "ACTIVE" ? "secondary" : "outline"}>
        {row.original.status === "ACTIVE" ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    id: "firstLogin",
    accessorKey: "isFirstLogin",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="First Login" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {row.original.isFirstLogin ? "Required" : "Completed"}
      </Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created Date" />
    ),
    cell: ({ row }) => formatDate(row.original.createdAt),
  },
];
