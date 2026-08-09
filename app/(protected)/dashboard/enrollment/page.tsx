"use client";

import {
  Suspense,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { Download } from "lucide-react";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { DataTable } from "@/components/data-table";
import { EnrollmentTableSkeleton } from "@/components/skeletons/enrollment-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEnrollments } from "@/hooks/enrollment.hook";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";
import {
  EnrollmentSemesterFilterSchema,
  EnrollmentStatusSchema,
  type EnrollmentTableQueryInput,
  type EnrollmentListItem,
} from "@/schemas";

import { CreateEnrollmentDialog } from "./components/create-enrollment-dialog";
import {
  EnrollmentDialogManager,
  type EnrollmentDialogType,
} from "./components/enrollment-dialog-manager";
import { enrollmentColumns } from "./components/enrollment-columns";
import {
  EnrollmentToolbar,
  enrollmentFilterKeys,
} from "./components/enrollment-toolbar";

const enrollmentSortFields = [
  "studentLrn",
  "studentName",
  "sectionGradeLevel",
  "sectionTrackStrand",
  "sectionName",
  "academicYear",
  "semester",
  "status",
] as const;

export default function EnrollmentPage() {
  return (
    <Suspense fallback={<EnrollmentTableSkeleton />}>
      <EnrollmentPageContent />
    </Suspense>
  );
}

function EnrollmentPageContent() {
  const tableState = useTableUrlState({
    filterKeys: enrollmentFilterKeys,
    sortableColumns: enrollmentSortFields,
  });
  const status = EnrollmentStatusSchema.safeParse(tableState.filters.status);
  const semester = EnrollmentSemesterFilterSchema.safeParse(
    tableState.filters.semester,
  );
  const gradeLevel = tableState.filters.gradeLevel.trim();
  const academicYearId = tableState.filters.academicYearId.trim();
  const sectionId = tableState.filters.sectionId.trim();
  const search = tableState.query.q?.trim().slice(0, 100);
  const normalizeUrl = useEffectEvent(() => {
    if (tableState.filters.status && !status.success) {
      tableState.setFilter("status", "");
    }

    if (tableState.filters.semester && !semester.success) {
      tableState.setFilter("semester", "");
    }

    if (tableState.filters.gradeLevel !== gradeLevel) {
      tableState.setFilter("gradeLevel", gradeLevel);
    }

    if (tableState.filters.academicYearId !== academicYearId) {
      tableState.setFilter("academicYearId", academicYearId);
    }

    if (tableState.filters.sectionId !== sectionId) {
      tableState.setFilter("sectionId", sectionId);
    }

    if (tableState.query.q !== search) {
      tableState.setSearch(search ?? "");
    }
  });
  const query: EnrollmentTableQueryInput = {
    q: search || undefined,
    status: status.success ? status.data : undefined,
    gradeLevel: gradeLevel || undefined,
    academicYearId: academicYearId || undefined,
    sectionId: sectionId || undefined,
    semester: semester.success ? semester.data : undefined,
    sort: tableState.query.sort as EnrollmentTableQueryInput["sort"],
    direction: tableState.query
      .direction as EnrollmentTableQueryInput["direction"],
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
  } = useEnrollments(query);
  const [{ selectedEnrollment, dialog, instanceId }, setDialogState] = useState<{
    selectedEnrollment: EnrollmentListItem | null;
    dialog: EnrollmentDialogType;
    instanceId: number;
  }>({
    selectedEnrollment: null,
    dialog: null,
    instanceId: 0,
  });
  const columns = useMemo(
    () =>
      enrollmentColumns({
        onEdit: (enrollment) => {
          setDialogState((current) => ({
            selectedEnrollment: enrollment,
            dialog: "edit",
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
  const displayedPagination =
    isPlaceholderData && data
      ? {
          pageIndex: data.page - 1,
          pageSize: data.pageSize,
        }
      : tableState.pagination;

  useEffect(() => {
    normalizeUrl();
  }, [
    semester.success,
    status.success,
    academicYearId,
    gradeLevel,
    search,
    sectionId,
    tableState.filters.semester,
    tableState.filters.status,
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

  function closeDialog(closingInstanceId: number) {
    setDialogState((current) =>
      current.instanceId === closingInstanceId
        ? { ...current, selectedEnrollment: null, dialog: null }
        : current,
    );
  }

  const errorFallback = (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
      <div className="space-y-1">
        <p className="font-medium">Unable to load enrollment records</p>
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
          <h1 className="text-2xl font-semibold">Enrollment Records</h1>
          <p className="text-sm text-muted-foreground">
            Search and filter student enrollment records.
          </p>
        </div>

        <CrudToolbar primaryAction={<CreateEnrollmentDialog />} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            onRowClick={(enrollment) => {
              setDialogState((current) => ({
                selectedEnrollment: enrollment,
                dialog: "view",
                instanceId: current.instanceId + 1,
              }));
            }}
            toolbar={() => (
              <EnrollmentToolbar
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
              loadingFallback: <EnrollmentTableSkeleton />,
              errorFallback,
              emptyTitle: tableState.hasActiveFilters
                ? "No matching enrollment records"
                : "No enrollment records yet",
              emptyDescription: tableState.hasActiveFilters
                ? "Try adjusting or clearing the current search and filters."
                : "Create an enrollment to add the first record.",
              emptyAction: tableState.hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={tableState.reset}>
                  Clear filters
                </Button>
              ) : undefined,
            }}
          />
          <EnrollmentDialogManager
            enrollment={selectedEnrollment}
            dialog={dialog}
            instanceId={instanceId}
            onClose={closeDialog}
          />
        </CardContent>
      </Card>
    </div>
  );
}
