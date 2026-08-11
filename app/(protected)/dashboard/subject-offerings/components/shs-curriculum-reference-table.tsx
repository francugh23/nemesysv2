"use client";

import type { ColumnDef } from "@tanstack/react-table";

import type { getShsCurriculumReferencesAction } from "@/actions/subject-offering.action";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";

type Reference = Awaited<ReturnType<typeof getShsCurriculumReferencesAction>>[number];

const columns: ColumnDef<Reference>[] = [
  { id: "subject", header: "Reference Subject", cell: ({ row }) => `${row.original.subject.code} - ${row.original.subject.description}` },
  { accessorKey: "gradeLevel", header: "Grade", cell: ({ row }) => `Grade ${row.original.gradeLevel}` },
  { accessorKey: "classification", header: "Classification", cell: ({ row }) => row.original.classification.replaceAll("_", " ") },
  { id: "cluster", header: "Cluster", cell: ({ row }) => row.original.cluster?.name ?? "Core Subject" },
  { accessorKey: "termApplicability", header: "Term Evidence", cell: ({ row }) => row.original.termApplicability === "ALL_CONFIGURED_TERMS" ? "All configured terms" : "Not specified by DepEd" },
  {
    accessorKey: "curriculumStatus",
    header: "Status",
    cell: () => <Badge variant="secondary">Provisional DepEd</Badge>,
  },
  {
    accessorKey: "sourceReference",
    header: "Source",
    cell: ({ row }) => <a className="text-primary underline-offset-4 hover:underline" href={row.original.sourceReference.match(/https?:\/\/[^\s;]+/)?.[0]} target="_blank" rel="noreferrer">DepEd source</a>,
  },
];

export function ShsCurriculumReferenceTable({ references }: { references: Reference[] }) {
  return <DataTable columns={columns} data={references} state={{ emptyTitle: "No provisional SSHS references", emptyDescription: "The controlled DepEd reference catalog has not been populated." }} />;
}
