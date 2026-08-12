"use client";

import { useEffect, useEffectEvent } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import type { getShsCurriculumReferencesAction } from "@/actions/subject-offering.action";
import { DataTable, resolveServerPagination } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useShsCurriculumReferences } from "@/hooks/subject-offering.hook";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";

type Reference = Awaited<ReturnType<typeof getShsCurriculumReferencesAction>>["items"][number];

const categoryLabels = {
  ARTS_SOCIAL_SCIENCE_HUMANITIES: "Arts, Social Science, and Humanities",
  BUSINESS_ENTREPRENEURSHIP: "Business and Entrepreneurship",
  SCIENCE_TECHNOLOGY_ENGINEERING_MATHEMATICS: "Science, Technology, Engineering, and Mathematics",
  ICT_SUPPORT_COMPUTER_PROGRAMMING_TECHNOLOGIES: "ICT Support and Computer Programming Technologies",
} as const;

const columns: ColumnDef<Reference>[] = [
  { id: "subject", header: "Reference Subject", cell: ({ row }) => `${row.original.subject.code} - ${row.original.subject.description}` },
  { accessorKey: "gradeLevel", header: "Grade", cell: ({ row }) => `Grade ${row.original.gradeLevel}` },
  { accessorKey: "classification", header: "Classification", cell: ({ row }) => row.original.classification.replaceAll("_", " ") },
  { id: "cluster", header: "DepEd Source Cluster", cell: ({ row }) => row.original.cluster?.name ?? "Core Subject" },
  { id: "schoolCategories", header: "School-Facing Categories", cell: ({ row }) => row.original.schoolCategories.map((category) => categoryLabels[category]).join(", ") || "Unresolved" },
  {
    accessorKey: "termApplicability",
    header: "Term Evidence",
    cell: ({ row }) => {
      if (row.original.termApplicability === "ALL_CONFIGURED_TERMS") return "All configured terms";
      if (row.original.termApplicability === "EXACT_CONFIGURED_TERMS") return row.original.termPositions.map((position) => `Term ${position}`).join(", ");
      if (row.original.termApplicability === "ONE_CONFIGURED_TERM_UNRESOLVED") return "One term; exact configured Term unresolved";
      return "Not specified by DepEd";
    },
  },
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

export function ShsCurriculumReferenceTable() {
  const tableState = useTableUrlState({
    filterKeys: [],
    sortableColumns: [],
    pageParam: "catalogPage",
    pageSizeParam: "catalogPageSize",
  });
  const query = { page: tableState.query.page, pageSize: tableState.query.pageSize };
  const { data, isLoading, isError, isFetching, isPlaceholderData, refetch } = useShsCurriculumReferences(query);
  const reconcilePage = useEffectEvent((page: number) => {
    tableState.onPaginationChange({ ...tableState.pagination, pageIndex: page - 1 });
  });
  const serverPagination = resolveServerPagination({
    requestedPagination: tableState.pagination,
    resolvedPage: data,
    isPlaceholderData,
  });

  useEffect(() => {
    if (data && serverPagination.shouldReconcile) reconcilePage(data.page);
  }, [data, serverPagination.shouldReconcile]);

  return <DataTable
    columns={columns}
    data={data?.items ?? []}
    server={{
      pagination: serverPagination.pagination,
      sorting: tableState.sorting,
      pageCount: data?.pageCount ?? 0,
      totalCount: data?.totalCount ?? 0,
      onPaginationChange: tableState.onPaginationChange,
      onSortingChange: tableState.onSortingChange,
      pageSizeOptions: tableState.pageSizeOptions,
      disabled: isPlaceholderData,
    }}
    state={{
      isLoading,
      isError,
      isFetching,
      errorFallback: <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center"><p className="text-sm text-muted-foreground">Unable to load provisional SSHS references.</p><Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>{isFetching ? "Retrying..." : "Try again"}</Button></div>,
      emptyTitle: "No provisional SSHS references",
      emptyDescription: "The controlled DepEd reference catalog has not been populated.",
    }}
  />;
}
