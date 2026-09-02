"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { displayValue, formatFullName } from "@/lib/format";
import type { SubjectAssignmentListItem } from "@/schemas";

import { SubjectAssignmentActions } from "./subject-assignment-actions";

interface SubjectAssignmentColumnProps {
  onEdit?: (assignment: SubjectAssignmentListItem) => void;
  onArchive?: (assignment: SubjectAssignmentListItem) => void;
  readOnly?: boolean;
}

export function subjectAssignmentColumns({
  onEdit,
  onArchive,
  readOnly = false,
}: SubjectAssignmentColumnProps): ColumnDef<SubjectAssignmentListItem>[] {
  return [
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
      cell: ({ row }: { row: { original: SubjectAssignmentListItem } }) =>
        formatFullName(
          row.original.teacherFirstName,
          row.original.teacherMiddleName,
          row.original.teacherLastName,
        ),
    },
    {
      accessorKey: "subjectOfferingCode",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subject Code" />
      ),
    },
    {
      accessorKey: "subjectOfferingDescription",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Subject Description" />
      ),
    },
    {
      accessorKey: "academicTermName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Term" />,
    },
    {
      accessorKey: "sectionGradeLevel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Grade Level" />
      ),
    },
    {
      accessorKey: "sectionName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Section Name" />
      ),
    },
    {
      accessorKey: "academicYearLabel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Academic Year" />
      ),
    },
      ...(readOnly ? [] : [{
        id: "actions",
      cell: ({ row }: { row: { original: SubjectAssignmentListItem } }) =>
        row.original.academicYearStatus === "ACTIVE" ? (
          <SubjectAssignmentActions
            assignment={row.original}
            onEdit={onEdit!}
            onArchive={onArchive!}
          />
        ) : null,
      }]),
  ];
}
