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
  onArchive: (teacher: TeacherListItem) => void;
}

export function teacherColumns({
  onEdit,
  onDeactivate,
  onArchive,
}: TeacherColumnProps): ColumnDef<TeacherListItem>[] {
  return [
    {
      id: "employeeNumber",
      accessorFn: (teacher) => teacher.employeeNumber,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Employee No." />
      ),
      cell: ({ row }) => row.original.employeeNumber,
    },
    {
      id: "lastName",
      accessorFn: (teacher) => teacher.lastName,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Name" />
      ),
    },
    {
      id: "firstName",
      accessorFn: (teacher) => teacher.firstName,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="First Name" />
      ),
    },
    {
      id: "middleName",
      accessorFn: (teacher) => teacher.middleName ?? "",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Middle Name" />
      ),
      cell: ({ row }) => row.original.middleName ?? "-",
    },
    {
      id: "gender",
      accessorFn: (teacher) => teacher.gender,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Gender" />
      ),
      cell: ({ row }) => <GenderBadge gender={row.original.gender} />,
    },
    {
      id: "email",
      accessorFn: (teacher) => teacher.email ?? "",
      header: "Email",
      cell: ({ row }) => row.original.email ?? "-",
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
      id: "adviser",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Adviser" />
      ),
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.activeAdvisedSectionCount ? `Yes (${row.original.activeAdvisedSectionCount})` : "No"}
        </Badge>
      ),
    },
    {
      id: "assignmentCount",
      accessorFn: (teacher) => teacher.activeSubjectAssignmentCount,
      header: "Active Assignments",
      cell: ({ row }) => row.original.activeSubjectAssignmentCount,
    },
    {
      id: "linkedAccount",
      accessorFn: (teacher) => teacher.hasLinkedAccount,
      header: "Linked Account",
      cell: ({ row }) => <Badge variant="outline">{row.original.hasLinkedAccount ? "Linked" : "None"}</Badge>,
    },
    {
      id: "status",
      accessorFn: (teacher) => teacher.status,
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Account Status" />
      ),
      cell: ({ row }) => (
        <Badge
          variant={
             row.original.status === "ACTIVE" ? "secondary" : "outline"
          }
        >
           {row.original.status === "ACTIVE" ? "Active" : "Inactive"}
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
          onArchive={onArchive}
        />
      ),
    },
  ];
}
