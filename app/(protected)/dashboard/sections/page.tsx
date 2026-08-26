"use client";

import { Download } from "lucide-react";
import {
  Suspense,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { DataTable, resolveServerPagination } from "@/components/data-table";
import { SectionTableSkeleton } from "@/components/skeletons/section-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSections } from "@/hooks/section.hook";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";
import {
  SectionGradeLevelSchema,
  SectionShiftSchema,
  type SectionListItem,
  type SectionTableQueryInput,
} from "@/schemas";

import { CreateSectionDialog } from "./components/create-section-dialog";
import {
  SectionDialogManager,
  type SectionDialogType,
} from "./components/section-dialog-manager";
import { sectionColumns } from "./components/section-columns";
import {
  sectionFilterKeys,
  SectionToolbar,
} from "./components/section-toolbar";

const sectionSortFields = [
  "grade",
  "sectionName",
  "adviser",
  "room",
  "shift",
] as const;

export default function SectionsPage() {
  return (
    <Suspense fallback={<SectionTableSkeleton />}>
      <SectionsPageContent />
    </Suspense>
  );
}

function SectionsPageContent() {
  const tableState = useTableUrlState({
    filterKeys: sectionFilterKeys,
    sortableColumns: sectionSortFields,
  });
  const grade = SectionGradeLevelSchema.safeParse(tableState.filters.grade);
  const shift = SectionShiftSchema.safeParse(tableState.filters.shift);
  const adviserId = tableState.filters.adviserId.trim();
  const search = tableState.query.q?.trim().slice(0, 100);
  const normalizeUrl = useEffectEvent(() => {
    if (tableState.filters.grade && !grade.success) {
      tableState.setFilter("grade", "");
    }

    if (tableState.filters.shift && !shift.success) {
      tableState.setFilter("shift", "");
    }

    if (tableState.filters.adviserId !== adviserId) {
      tableState.setFilter("adviserId", adviserId);
    }

    if (tableState.query.q !== search) {
      tableState.setSearch(search ?? "");
    }
  });
  const query: SectionTableQueryInput = {
    q: search || undefined,
    grade: grade.success ? grade.data : undefined,
    shift: shift.success ? shift.data : undefined,
    adviserId: adviserId || undefined,
    sort: tableState.query.sort as SectionTableQueryInput["sort"],
    direction: tableState.query.direction as SectionTableQueryInput["direction"],
    page: tableState.query.page,
    pageSize: tableState.query.pageSize,
  };
  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
    isPlaceholderData,
  } = useSections(query);
  const [{ selectedSection, dialog, instanceId }, setDialogState] = useState<{
    selectedSection: SectionListItem | null;
    dialog: SectionDialogType;
    instanceId: number;
  }>({
    selectedSection: null,
    dialog: null,
    instanceId: 0,
  });
  const columns = useMemo(
    () =>
      sectionColumns({
        onEdit: (section) => {
          setDialogState((current) => ({
            selectedSection: section,
            dialog: "edit",
            instanceId: current.instanceId + 1,
          }));
        },
        onArchive: (section) => {
          setDialogState((current) => ({
            selectedSection: section,
            dialog: "archive",
            instanceId: current.instanceId + 1,
          }));
        },
      }),
    [],
  );
  const reconcilePage = useEffectEvent((page: number) => {
    tableState.onPaginationChange({
      ...tableState.pagination,
      pageIndex: page - 1,
    });
  });
  const serverPagination = resolveServerPagination({
    requestedPagination: tableState.pagination,
    resolvedPage: data,
    isPlaceholderData,
  });

  useEffect(() => {
    normalizeUrl();
  }, [
    adviserId,
    grade.success,
    search,
    shift.success,
    tableState.filters.adviserId,
    tableState.filters.grade,
    tableState.filters.shift,
    tableState.query.q,
  ]);

  useEffect(() => {
    if (
      data && serverPagination.shouldReconcile
    ) {
      reconcilePage(data.page);
    }
  }, [data, serverPagination.shouldReconcile]);

  function closeDialog(closingInstanceId: number) {
    setDialogState((current) =>
      current.instanceId === closingInstanceId
        ? { ...current, selectedSection: null, dialog: null }
        : current,
    );
  }

  const errorFallback = (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
      <div className="space-y-1">
        <p className="font-medium">Unable to load section records</p>
        <p className="text-sm text-muted-foreground">
          Check your connection and try again.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => void refetch()}
        disabled={isFetching}
      >
        {isFetching ? "Retrying..." : "Try again"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Section Records</h1>
          <p className="text-sm text-muted-foreground">
            Search, filter and manage active sections.
          </p>
        </div>

        <CrudToolbar primaryAction={<CreateSectionDialog />} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            onRowClick={(section) => {
              setDialogState((current) => ({
                selectedSection: section,
                dialog: "view",
                instanceId: current.instanceId + 1,
              }));
            }}
            toolbar={() => (
              <SectionToolbar
                search={tableState.search}
                onSearchChange={tableState.setSearch}
                filters={tableState.filters}
                onFilterChange={tableState.setFilter}
                canReset={tableState.canReset}
                onReset={tableState.reset}
                isFetching={isFetching && !isLoading}
                searchResetKey={tableState.resetKey}
                actions={
                  <Button variant="outline" disabled>
                    <Download />
                    Export
                  </Button>
                }
              />
            )}
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
              loadingFallback: <SectionTableSkeleton />,
              errorFallback,
              emptyTitle: tableState.hasActiveFilters
                ? "No matching section records"
                : "No section records yet",
              emptyDescription: tableState.hasActiveFilters
                ? "Try adjusting or clearing the current search and filters."
                : "Create a section to add the first record.",
              emptyAction: tableState.hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={tableState.reset}>
                  Clear filters
                </Button>
              ) : undefined,
            }}
          />
          <SectionDialogManager
            section={selectedSection}
            dialog={dialog}
            instanceId={instanceId}
            onClose={closeDialog}
          />
        </CardContent>
      </Card>
    </div>
  );
}
