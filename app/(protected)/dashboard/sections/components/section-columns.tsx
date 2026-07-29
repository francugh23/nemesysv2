"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { displayValue, formatFullName } from "@/lib/format";
import type { SectionListItem } from "@/schemas";

import { SectionActions } from "./section-actions";

interface SectionColumnProps {
  onEdit: (section: SectionListItem) => void;
  onArchive: (section: SectionListItem) => void;
}

export function sectionColumns({
  onEdit,
  onArchive,
}: SectionColumnProps): ColumnDef<SectionListItem>[] {
  return [
    {
      accessorKey: "gradeLevel",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Grade" />
      ),
    },
    {
      accessorKey: "trackStrand",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Track / Strand" />
      ),
      cell: ({ row }) => displayValue(row.original.trackStrand),
    },
    {
      accessorKey: "sectionName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Section Name" />
      ),
    },
    {
      accessorKey: "adviserLastName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Adviser" />
      ),
      cell: ({ row }) => {
        const section = row.original;

        if (!section.adviserFirstName || !section.adviserLastName) {
          return displayValue(null);
        }

        return formatFullName(
          section.adviserFirstName,
          section.adviserMiddleName,
          section.adviserLastName,
        );
      },
    },
    {
      accessorKey: "room",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Room" />
      ),
      cell: ({ row }) => displayValue(row.original.room),
    },
    {
      accessorKey: "shift",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Shift" />
      ),
      cell: ({ row }) => {
        const shift = row.original.shift;

        return shift
          ? shift.charAt(0) + shift.slice(1).toLowerCase()
          : displayValue(null);
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <SectionActions
          section={row.original}
          onEdit={onEdit}
          onArchive={onArchive}
        />
      ),
    },
  ];
}
