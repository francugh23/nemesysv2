"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { Button } from "@/components/ui/button";
import { displayValue, formatDateTime, formatFullName } from "@/lib/format";
import type { AuditLogListItem } from "@/schemas";

import { AuditLogRecordLink, getAuditLogRecordHref } from "./audit-log-record-link";

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
      cell: ({ row }) => <AuditLogTimestamp timestamp={row.original.createdAt} />,
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
        const { module, recordId, recordName } = row.original;
        const href = getAuditLogRecordHref(module, recordId, recordName);

        return recordName ? (
          <div className="min-w-40">
            <p><AuditLogRecordLink href={href}>{recordName}</AuditLogRecordLink></p>
            <p className="text-xs text-muted-foreground">(<AuditLogRecordLink href={href}>{displayValue(recordId)}</AuditLogRecordLink>)</p>
          </div>
        ) : (
          <AuditLogRecordLink href={href}>{displayValue(recordId)}</AuditLogRecordLink>
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

function AuditLogTimestamp({ timestamp }: { timestamp: Date }) {
  const relativeTime = formatRelativeTime(timestamp);

  return (
    <div className="min-w-40">
      <p>{formatDateTime(timestamp)}</p>
      <p className="text-xs text-muted-foreground">{relativeTime}</p>
    </div>
  );
}

function formatRelativeTime(timestamp: Date) {
  const differenceInSeconds = Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 1000));

  if (differenceInSeconds < 60) return "just now";
  if (differenceInSeconds < 3600) return `${Math.floor(differenceInSeconds / 60)} minute${Math.floor(differenceInSeconds / 60) === 1 ? "" : "s"} ago`;
  if (differenceInSeconds < 86400) return `${Math.floor(differenceInSeconds / 3600)} hour${Math.floor(differenceInSeconds / 3600) === 1 ? "" : "s"} ago`;
  return `${Math.floor(differenceInSeconds / 86400)} day${Math.floor(differenceInSeconds / 86400) === 1 ? "" : "s"} ago`;
}
