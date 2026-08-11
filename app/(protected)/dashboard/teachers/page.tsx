"use client";

import { Download } from "lucide-react";
import { Suspense, useEffect, useEffectEvent, useMemo, useState } from "react";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { DataTable, resolveServerPagination } from "@/components/data-table";
import { TeacherTableSkeleton } from "@/components/skeletons/teacher-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTeachers } from "@/hooks/teacher.hook";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";
import {
  TeacherGenderSchema,
  TeacherStatusSchema,
  type TeacherListItem,
  type TeacherTableQueryInput,
} from "@/schemas";

import { CreateTeacherDialog } from "./components/create-teacher-dialog";
import {
  TeacherDialogManager,
  type TeacherDialogType,
} from "./components/teacher-dialog-manager";
import { teacherColumns } from "./components/teacher-columns";
import {
  teacherFilterKeys,
  TeacherToolbar,
} from "./components/teacher-toolbar";

const teacherSortFields = [
  "employeeNumber",
  "lastName",
  "firstName",
  "middleName",
  "gender",
  "degree",
  "major",
  "isAdviser",
  "status",
  "createdAt",
] as const;

export default function TeachersPage() {
  return (
    <Suspense fallback={<TeacherTableSkeleton />}>
      <TeachersPageContent />
    </Suspense>
  );
}

function TeachersPageContent() {
  const tableState = useTableUrlState({
    filterKeys: teacherFilterKeys,
    sortableColumns: teacherSortFields,
  });
  const status = TeacherStatusSchema.safeParse(tableState.filters.status);
  const gender = TeacherGenderSchema.safeParse(tableState.filters.gender);
  const search = tableState.query.q?.trim().slice(0, 100);
  const normalizeUrl = useEffectEvent(() => {
    if (tableState.filters.status && !status.success) {
      tableState.setFilter("status", "");
    }

    if (tableState.filters.gender && !gender.success) {
      tableState.setFilter("gender", "");
    }

    if (tableState.query.q !== search) {
      tableState.setSearch(search ?? "");
    }
  });
  const query: TeacherTableQueryInput = {
    q: search || undefined,
    status: status.success ? status.data : undefined,
    gender: gender.success ? gender.data : undefined,
    sort: tableState.query.sort as TeacherTableQueryInput["sort"],
    direction: tableState.query.direction as TeacherTableQueryInput["direction"],
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
  } = useTeachers(query);
  const [selectedTeacher, setSelectedTeacher] =
    useState<TeacherListItem | null>(null);
  const [dialog, setDialog] = useState<TeacherDialogType>(null);
  const columns = useMemo(
    () =>
      teacherColumns({
        onEdit: (teacher) => {
          setSelectedTeacher(teacher);
          setDialog("edit");
        },
        onDeactivate: (teacher) => {
          setSelectedTeacher(teacher);
          setDialog("deactivate");
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
    gender.success,
    status.success,
    search,
    tableState.filters.gender,
    tableState.filters.status,
    tableState.query.q,
  ]);

  useEffect(() => {
    if (
      data && serverPagination.shouldReconcile
    ) {
      reconcilePage(data.page);
    }
  }, [data, serverPagination.shouldReconcile]);

  const errorFallback = (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
      <div className="space-y-1">
        <p className="font-medium">Unable to load teacher records</p>
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
          <h1 className="text-2xl font-semibold">Teacher Records</h1>
          <p className="text-sm text-muted-foreground">
            View teacher profiles and account status.
          </p>
        </div>

        <CrudToolbar primaryAction={<CreateTeacherDialog />} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            onRowClick={(teacher) => {
              setSelectedTeacher(teacher);
              setDialog("view");
            }}
            toolbar={() => (
              <TeacherToolbar
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
              loadingFallback: <TeacherTableSkeleton />,
              errorFallback,
              emptyTitle: tableState.hasActiveFilters
                ? "No matching teacher records"
                : "No teacher records yet",
              emptyDescription: tableState.hasActiveFilters
                ? "Try adjusting or clearing the current search and filters."
                : "Create a teacher to add the first record.",
              emptyAction: tableState.hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={tableState.reset}>
                  Clear filters
                </Button>
              ) : undefined,
            }}
          />
          <TeacherDialogManager
            teacher={selectedTeacher}
            dialog={dialog}
            onClose={() => {
              setSelectedTeacher(null);
              setDialog(null);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
