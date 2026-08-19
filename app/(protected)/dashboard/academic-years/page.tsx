"use client";

import {
  Suspense,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { AcademicConfigurationNav } from "@/components/common/academic-configuration-nav";
import { DataTable, resolveServerPagination } from "@/components/data-table";
import { AcademicYearTableSkeleton } from "@/components/skeletons/academic-year-table-skeleton";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { Card, CardContent } from "@/components/ui/card";
import { useAcademicYears } from "@/hooks/academic-year.hook";
import { hasPermission, Permissions } from "@/lib/permissions";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";
import {
  AcademicYearStatusSchema,
  type AcademicYearListItem,
  type AcademicYearTableQueryInput,
} from "@/schemas";

import { academicYearColumns } from "./components/academic-year-columns";
import {
  AcademicYearDialogManager,
  type AcademicYearDialogType,
} from "./components/academic-year-dialog-manager";
import {
  academicYearFilterKeys,
  AcademicYearToolbar,
} from "./components/academic-year-toolbar";
import { CreateAcademicYearDialog } from "./components/create-academic-year-dialog";

const academicYearSortFields = [
  "label",
  "startDate",
  "endDate",
  "status",
] as const;

export default function AcademicYearsPage() {
  return (
    <Suspense fallback={<AcademicYearTableSkeleton />}>
      <AcademicYearsPageContent />
    </Suspense>
  );
}

function AcademicYearsPageContent() {
  const { data: session } = useSession();
  const canAdoptCurriculum = hasPermission(
    session?.user.role,
    Permissions.SUBJECTS,
  );
  const canManageElectivePolicy = hasPermission(
    session?.user.role,
    Permissions.SHS_CURRICULUM_APPROVAL,
  );
  const canManageInterpretationPolicy = hasPermission(
    session?.user.role,
    Permissions.GRADES,
  );
  const tableState = useTableUrlState({
    filterKeys: academicYearFilterKeys,
    sortableColumns: academicYearSortFields,
  });
  const status = AcademicYearStatusSchema.safeParse(tableState.filters.status);
  const search = tableState.query.q?.trim().slice(0, 100);
  const normalizeUrl = useEffectEvent(() => {
    if (tableState.filters.status && !status.success) {
      tableState.setFilter("status", "");
    }

    if (tableState.query.q !== search) {
      tableState.setSearch(search ?? "");
    }
  });
  const query: AcademicYearTableQueryInput = {
    q: search || undefined,
    status: status.success ? status.data : undefined,
    sort: tableState.query.sort as AcademicYearTableQueryInput["sort"],
    direction: tableState.query
      .direction as AcademicYearTableQueryInput["direction"],
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
  } = useAcademicYears(query);
  const [{ selectedAcademicYear, dialog, instanceId }, setDialogState] =
    useState<{
      selectedAcademicYear: AcademicYearListItem | null;
      dialog: AcademicYearDialogType;
      instanceId: number;
    }>({
      selectedAcademicYear: null,
      dialog: null,
      instanceId: 0,
    });

  function openDialog(
    academicYear: AcademicYearListItem,
    nextDialog: Exclude<AcademicYearDialogType, null>,
  ) {
    setDialogState((current) => ({
      selectedAcademicYear: academicYear,
      dialog: nextDialog,
      instanceId: current.instanceId + 1,
    }));
  }

  const columns = useMemo(
    () =>
      academicYearColumns({
        onView: (academicYear) => openDialog(academicYear, "view"),
        onEdit: (academicYear) => openDialog(academicYear, "edit"),
        onActivate: (academicYear) => openDialog(academicYear, "activate"),
        onLock: (academicYear) => openDialog(academicYear, "lock"),
        onArchive: (academicYear) => openDialog(academicYear, "archive"),
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
  }, [search, status.success, tableState.filters.status, tableState.query.q]);

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
        ? { ...current, selectedAcademicYear: null, dialog: null }
        : current,
    );
  }

  const errorFallback = (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
      <div className="space-y-1">
        <p className="font-medium">Unable to load academic years</p>
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
          <h1 className="text-2xl font-semibold">Academic Years</h1>
          <p className="text-sm text-muted-foreground">
            Create academic years and manage their lifecycle.
          </p>
        </div>

        <CrudToolbar primaryAction={<CreateAcademicYearDialog />} />
      </div>

      <AcademicConfigurationNav
        current="Academic Years"
        showSubjects={hasPermission(session?.user.role, Permissions.SUBJECTS)}
      />

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            onRowClick={(academicYear) => openDialog(academicYear, "view")}
            toolbar={() => (
              <AcademicYearToolbar
                search={tableState.search}
                onSearchChange={tableState.setSearch}
                filters={tableState.filters}
                onFilterChange={tableState.setFilter}
                canReset={tableState.canReset}
                onReset={tableState.reset}
                isFetching={isFetching && !isLoading}
                searchResetKey={tableState.resetKey}
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
              loadingFallback: <AcademicYearTableSkeleton />,
              errorFallback,
              emptyTitle: tableState.hasActiveFilters
                ? "No matching academic years"
                : "No academic years yet",
              emptyDescription: tableState.hasActiveFilters
                ? "Try adjusting or clearing the current search and status filter."
                : "Create an academic year to add the first record.",
              emptyAction: tableState.hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={tableState.reset}>
                  Clear filters
                </Button>
              ) : undefined,
            }}
          />
          <AcademicYearDialogManager
            academicYear={selectedAcademicYear}
            dialog={dialog}
            instanceId={instanceId}
            onClose={closeDialog}
            canAdoptCurriculum={canAdoptCurriculum}
            canManageElectivePolicy={canManageElectivePolicy}
            canManageInterpretationPolicy={canManageInterpretationPolicy}
            onAdoptCurriculum={(academicYear) =>
              openDialog(academicYear, "adopt-curriculum")
            }
            onManageElectivePolicy={(academicYear) =>
              openDialog(academicYear, "elective-policies")
            }
            onManageInterpretationPolicy={(academicYear) =>
              openDialog(academicYear, "result-interpretation-policy")
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
