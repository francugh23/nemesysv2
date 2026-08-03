"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Button } from "@/components/ui/button";
import { displayValue, formatDateTime, formatFullName } from "@/lib/format";
import type { AuditLogListItem } from "@/schemas";

export function auditLogColumns({
  onViewDetails,
}: {
  onViewDetails: (auditLog: AuditLogListItem) => void;
}): ColumnDef<AuditLogListItem>[] {
  return [
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Timestamp" />
      ),
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: "actor",
      accessorKey: "actorLastName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Actor" />
      ),
      cell: ({ row }) => (
        <div className="min-w-40">
          <p>{formatFullName(row.original.actorFirstName, row.original.actorMiddleName, row.original.actorLastName)}</p>
          <p className="text-xs text-muted-foreground">{row.original.actorUsername}</p>
        </div>
      ),
    },
    {
      accessorKey: "module",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Module" />
      ),
    },
    {
      accessorKey: "action",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Action" />
      ),
    },
    {
      id: "record",
      accessorKey: "recordName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Record" />
      ),
      cell: ({ row }) => {
        const { recordId, recordName } = row.original;

        return recordName ? (
          <div className="min-w-40">
            <p>{recordName}</p>
            <p className="text-xs text-muted-foreground">({displayValue(recordId)})</p>
          </div>
        ) : (
          displayValue(recordId)
        );
      },
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Description" />
      ),
      cell: ({ row }) => <span className="line-clamp-2">{row.original.description}</span>,
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onViewDetails(row.original)}
        >
          View Details
        </Button>
      ),
    },
  ];
}
