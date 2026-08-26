"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { AcademicTermBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getShsCurriculumStatusLabel,
  getShsSubjectClassificationLabel,
} from "@/lib/shs-presentation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { SubjectOfferingListItem } from "./subject-offering-types";

export function subjectOfferingColumns({
  onEdit,
  onArchive,
  onApprove,
  onCorrect,
  onViewCorrection,
  canManageOfferings,
}: {
  onEdit: (offering: SubjectOfferingListItem) => void;
  onArchive: (offering: SubjectOfferingListItem) => void;
  onApprove: (offering: SubjectOfferingListItem) => void;
  onCorrect: (offering: SubjectOfferingListItem) => void;
  onViewCorrection: (offering: SubjectOfferingListItem) => void;
  canManageOfferings: boolean;
}): ColumnDef<SubjectOfferingListItem>[] {
  return [
    {
      accessorKey: "subjectCode",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Subject Code" />,
    },
    {
      accessorKey: "subjectDescription",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Subject Description" />,
    },
    {
      accessorKey: "gradeLevel",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Grade Level" />,
      cell: ({ row }) => `Grade ${row.original.gradeLevel}`,
    },
    {
      id: "academicYear",
      accessorFn: (row) => row.academicYear.label,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Academic Year" />,
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <span>{row.original.academicYear.label}</span>
          <Badge variant="outline">
            {row.original.academicYear.status.charAt(0) +
              row.original.academicYear.status.slice(1).toLowerCase()}
          </Badge>
        </div>
      ),
    },
    {
      id: "terms",
      header: "Terms",
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          {["7", "8", "9", "10"].includes(row.original.gradeLevel) && (
            <Badge>Full Academic Year</Badge>
          )}
          <div className="flex flex-wrap gap-1">
            {row.original.terms.map((term) => (
              <AcademicTermBadge
                key={term.academicTermId}
                position={term.academicTerm.position}
                name={term.academicTerm.name}
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "shsContext",
       header: "SHS Context / Approval",
      cell: ({ row }) => {
        const context = row.original.shsContext;
        if (!context) return "-";
        return (
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">
              {getShsSubjectClassificationLabel(context.classification)}
            </Badge>
            <Badge variant={context.curriculumStatus === "SCHOOL_APPROVED" ? "default" : "secondary"}>
              {getShsCurriculumStatusLabel(context.curriculumStatus)}
            </Badge>
            {context.cluster && <Badge variant="outline">{context.cluster.name}</Badge>}
          </div>
        );
      },
    },
    {
      id: "offeringState",
      header: "Configuration State",
      cell: ({ row }) => {
        const offering = row.original;
        const finalized = Boolean(offering.academicYear.curriculumFinalization);
        const depended = offering._count.studentSubjectEnrollments > 0;
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge variant={offering.deletedAt ? "secondary" : "default"}>
              {offering.deletedAt ? "Archived" : "Active"}
            </Badge>
            {finalized && <Badge variant="outline">Finalized</Badge>}
            {!finalized && depended && (
              <Badge variant="outline" title="Semantic configuration is protected because Student Participation references this Offering.">
                Locked by Student Participation
              </Badge>
            )}
            {offering.replacementCurriculumCorrection && (
              <Badge variant="secondary" title={`Prospective from ${offering.replacementCurriculumCorrection.effectiveAcademicTerm.name}.`}>
                Replacement
              </Badge>
            )}
            {offering.replacesSubjectOffering && (
              <span className="text-xs text-muted-foreground">Replaces {offering.replacesSubjectOffering.subjectCode}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      enableSorting: false,
      cell: ({ row }) => {
        const offering = row.original;
        const finalized = Boolean(offering.academicYear.curriculumFinalization);
        const depended = offering._count.studentSubjectEnrollments > 0;
        const ordinaryActions = !finalized && (canManageOfferings || offering.shsContext?.curriculumStatus === "PROVISIONAL_DEPED");
        const canCorrect = canManageOfferings && (finalized || depended);
        const canViewCorrection = canManageOfferings && Boolean(offering.replacementCurriculumCorrection);
        return offering.academicYear.status === "ACTIVE" && (ordinaryActions || canCorrect || canViewCorrection) ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Subject offering actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {canManageOfferings && !finalized && !depended && offering.shsContext?.curriculumStatus !== "SCHOOL_APPROVED" && <DropdownMenuItem onClick={() => onEdit(offering)}>Edit</DropdownMenuItem>}
              {!depended && offering.shsContext?.curriculumStatus === "PROVISIONAL_DEPED" && <DropdownMenuItem onClick={() => onApprove(offering)}>Approve for school use</DropdownMenuItem>}
              {canManageOfferings && !finalized && <DropdownMenuItem className="text-destructive" onClick={() => onArchive(offering)}>
                Archive
              </DropdownMenuItem>}
              {canCorrect && <DropdownMenuItem onClick={() => onCorrect(offering)}>Correct / Replace</DropdownMenuItem>}
              {canViewCorrection && <DropdownMenuItem onClick={() => onViewCorrection(offering)}>View correction details</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null;
      },
    },
  ];
}
