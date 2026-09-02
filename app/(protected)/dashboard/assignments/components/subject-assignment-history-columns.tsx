"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import type { SubjectAssignmentHistoryItem } from "@/schemas";

export function subjectAssignmentHistoryColumns({
  onView,
}: {
  onView: (assignment: SubjectAssignmentHistoryItem) => void;
}): ColumnDef<SubjectAssignmentHistoryItem>[] {
  return [
    {
      id: "academicYear",
      header: "Academic Year",
      cell: ({ row }) => row.original.academicYear.label,
    },
    {
      id: "term",
      header: "Term",
      cell: ({ row }) => row.original.term.name,
    },
    {
      id: "offering",
      header: "Offering",
      cell: ({ row }) => (
        <div className="min-w-48">
          <p className="font-medium">{row.original.offering.subjectCode}</p>
          <p className="truncate text-xs text-muted-foreground" title={row.original.offering.subjectDescription}>
            {row.original.offering.subjectDescription}
          </p>
        </div>
      ),
    },
    {
      id: "section",
      header: "Section",
      cell: ({ row }) => `Grade ${row.original.section.gradeLevel} ${row.original.section.sectionName}`,
    },
    {
      id: "teacher",
      header: "Teacher",
      cell: ({ row }) => (
        <div className="min-w-44">
          <p className="font-medium">{row.original.teacher.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.teacher.employeeNumber ?? "No employee number"}</p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "ACTIVE" ? "secondary" : "outline"}>
          {row.original.status === "ACTIVE" ? "Active" : "Archived"}
        </Badge>
      ),
    },
    {
      id: "changed",
      header: "Changed",
      cell: ({ row }) => (
        <span title={`${row.original.status === "ARCHIVED" ? "Archived" : "Updated"} ${formatDateTime(row.original.changedAt)}`}>
          {formatDate(row.original.changedAt)}
        </span>
      ),
    },
    {
      id: "view",
      header: "View",
      cell: ({ row }) => (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label={`View assignment details for ${row.original.offering.subjectCode}, ${row.original.section.sectionName}`}
          onClick={() => onView(row.original)}
        >
          View
        </Button>
      ),
    },
  ];
}
