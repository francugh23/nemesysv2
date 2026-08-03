"use client";

import { Download } from "lucide-react";
import { Suspense, useEffect, useEffectEvent } from "react";

import { DataTable } from "@/components/data-table";
import { AuditLogTableSkeleton } from "@/components/skeletons/audit-log-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuditLogs } from "@/hooks/audit.hook";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";
import {
  AuditLogDateSchema,
  type AuditLogTableQueryInput,
} from "@/schemas";

import { auditLogColumns } from "./components/audit-log-columns";
import { auditLogFilterKeys, AuditLogToolbar } from "./components/audit-log-toolbar";

const auditLogSortFields = [
  "createdAt",
  "actor",
  "module",
  "action",
  "record",
  "description",
] as const;

export default function AuditLogsPage() {
  return (
    <Suspense fallback={<AuditLogTableSkeleton />}>
      <AuditLogsPageContent />
    </Suspense>
  );
}

function AuditLogsPageContent() {
  const tableState = useTableUrlState({
    filterKeys: auditLogFilterKeys,
    sortableColumns: auditLogSortFields,
  });
  const dateFrom = AuditLogDateSchema.safeParse(tableState.filters.dateFrom);
  const dateTo = AuditLogDateSchema.safeParse(tableState.filters.dateTo);
  const hasValidDateRange =
    dateFrom.success &&
    dateTo.success &&
    dateFrom.data <= dateTo.data;
  const search = tableState.query.q?.trim().slice(0, 100);
  const normalizedQuery: AuditLogTableQueryInput = {
    q: search || undefined,
    module: tableState.filters.module.trim() || undefined,
    action: tableState.filters.action.trim() || undefined,
    actor: tableState.filters.actor.trim() || undefined,
    dateFrom:
      dateFrom.success && (!tableState.filters.dateTo || hasValidDateRange)
        ? dateFrom.data
        : undefined,
    dateTo:
      dateTo.success && (!tableState.filters.dateFrom || hasValidDateRange)
        ? dateTo.data
        : undefined,
    sort: tableState.query.sort as AuditLogTableQueryInput["sort"],
    direction: tableState.query
      .direction as AuditLogTableQueryInput["direction"],
    page: tableState.query.page,
    pageSize: tableState.query.pageSize,
  };
  const normalizeUrl = useEffectEvent(() => {
    if (tableState.filters.dateFrom && !dateFrom.success) {
      tableState.setFilter("dateFrom", "");
    }

    if (tableState.filters.dateTo && !dateTo.success) {
      tableState.setFilter("dateTo", "");
    }

    if (hasValidDateRange === false && dateFrom.success && dateTo.success) {
      tableState.setFilter("dateTo", "");
    }

    if (tableState.query.q !== search) {
      tableState.setSearch(search ?? "");
    }
  });
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    isPlaceholderData,
  } = useAuditLogs(normalizedQuery);
  const reconcilePage = useEffectEvent((page: number) => {
    tableState.onPaginationChange({
      ...tableState.pagination,
      pageIndex: page - 1,
    });
  });
  const displayedPagination =
    isPlaceholderData && data
      ? { pageIndex: data.page - 1, pageSize: data.pageSize }
      : tableState.pagination;

  useEffect(() => {
    normalizeUrl();
  }, [
    dateFrom.success,
    dateTo.success,
    hasValidDateRange,
    search,
    tableState.filters.dateFrom,
    tableState.filters.dateTo,
    tableState.query.q,
  ]);

  useEffect(() => {
    if (
      data &&
      !isPlaceholderData &&
      data.page !== tableState.pagination.pageIndex + 1
    ) {
      reconcilePage(data.page);
    }
  }, [data, isPlaceholderData, tableState.pagination.pageIndex]);

  const errorFallback = (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
      <div className="space-y-1">
        <p className="font-medium">Unable to load audit records</p>
        <p className="text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
      </div>
      <Button variant="outline" onClick={() => void refetch()} disabled={isFetching}>
        {isFetching ? "Retrying..." : "Try again"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Review immutable records of system activity.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={auditLogColumns}
            data={data?.items ?? []}
            toolbar={() => (
              <AuditLogToolbar
                search={tableState.search}
                onSearchChange={tableState.setSearch}
                filters={tableState.filters}
                onFilterChange={tableState.setFilter}
                canReset={tableState.canReset}
                onReset={tableState.reset}
                isFetching={isFetching && !isLoading}
                searchResetKey={tableState.resetKey}
                actions={<Button variant="outline" disabled><Download />Export</Button>}
              />
            )}
            server={{
              pagination: displayedPagination,
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
              loadingFallback: <AuditLogTableSkeleton />,
              errorFallback,
              emptyTitle: tableState.hasActiveFilters
                ? "No matching audit records"
                : "No audit records yet",
              emptyDescription: tableState.hasActiveFilters
                ? "Try adjusting or clearing the current search and filters."
                : "Audit records will appear here when activity is recorded.",
              emptyAction: tableState.hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={tableState.reset}>Clear filters</Button>
              ) : undefined,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
