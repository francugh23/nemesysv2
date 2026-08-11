"use client";

import { Suspense, useEffect, useEffectEvent, useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { DataTable, resolveServerPagination } from "@/components/data-table";
import { CrudToolbar } from "@/components/common/crud-toolbar";
import { ExportButton } from "@/components/common/export/export-button";
import { Button } from "@/components/ui/button";

import { useStudents } from "@/hooks/student.hook";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";
import {
  StudentGenderSchema,
  StudentStatusSchema,
  type StudentTableQueryInput,
} from "@/schemas";

import { studentColumns } from "./components/student-columns";
import { StudentTableSkeleton } from "@/components/skeletons/student-table-skeleton";
import type { StudentListItem } from "@/types/student";
import {
  StudentDialogManager,
  StudentDialogType,
} from "./components/student-dialog-manager";
import { CreateStudentDialog } from "./components/create-student-dialog";
import { StudentImportDialog } from "./components/student-import-dialog";
import {
  studentFilterKeys,
  StudentToolbar,
} from "./components/student-toolbar";
import { exportStudentsAction } from "@/actions/student.action";

const studentSortFields = [
  "lrn",
  "name",
  "gender",
  "status",
  "grade",
  "currentSection",
  "createdAt",
] as const;

export default function StudentsPage() {
  return (
    <Suspense fallback={<StudentTableSkeleton />}>
      <StudentsPageContent />
    </Suspense>
  );
}

function StudentsPageContent() {
  const tableState = useTableUrlState({
    filterKeys: studentFilterKeys,
    sortableColumns: studentSortFields,
  });
  const status = StudentStatusSchema.safeParse(tableState.filters.status);
  const gender = StudentGenderSchema.safeParse(tableState.filters.gender);
  const grade = tableState.filters.grade.trim();
  const sectionId = tableState.filters.sectionId.trim();
  const search = tableState.query.q?.trim().slice(0, 100);
  const normalizeUrl = useEffectEvent(() => {
    if (tableState.filters.status && !status.success) {
      tableState.setFilter("status", "");
    }

    if (tableState.filters.gender && !gender.success) {
      tableState.setFilter("gender", "");
    }

    if (tableState.filters.grade !== grade) {
      tableState.setFilter("grade", grade);
    }

    if (tableState.filters.sectionId !== sectionId) {
      tableState.setFilter("sectionId", sectionId);
    }

    if (tableState.query.q !== search) {
      tableState.setSearch(search ?? "");
    }
  });
  const query: StudentTableQueryInput = {
    q: search || undefined,
    status: status.success ? status.data : undefined,
    gender: gender.success ? gender.data : undefined,
    grade: grade || undefined,
    sectionId: sectionId || undefined,
    sort: tableState.query.sort as StudentTableQueryInput["sort"],
    direction: tableState.query.direction as StudentTableQueryInput["direction"],
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
  } = useStudents(query);
  const [selectedStudent, setSelectedStudent] =
    useState<StudentListItem | null>(null);
  const [dialog, setDialog] = useState<StudentDialogType>(null);
  const columns = useMemo(
    () =>
      studentColumns({
        onEdit: (student) => {
          setSelectedStudent(student);
          setDialog("edit");
        },

        onDelete: (student) => {
          setSelectedStudent(student);
          setDialog("delete");
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
    grade,
    search,
    sectionId,
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
        <p className="font-medium">Unable to load student records</p>
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
          <h1 className="text-2xl font-semibold">Student Records</h1>
          <p className="text-sm text-muted-foreground">
            Search, filter and manage students.
          </p>
        </div>

        <CrudToolbar primaryAction={<CreateStudentDialog />} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            onRowClick={(student) => {
              setSelectedStudent(student);
              setDialog("view");
            }}
            toolbar={() => (
              <StudentToolbar
                search={tableState.search}
                onSearchChange={tableState.setSearch}
                filters={tableState.filters}
                onFilterChange={tableState.setFilter}
                canReset={tableState.canReset}
                onReset={tableState.reset}
                isFetching={isFetching && !isLoading}
                searchResetKey={tableState.resetKey}
                actions={
                  <>
                    <StudentImportDialog
                      trigger={
                        <Button variant="outline">Import Student</Button>
                      }
                    />
                    <ExportButton
                      exportAction={(format) =>
                        exportStudentsAction(query, format)
                      }
                      disabled={isLoading || isError}
                    />
                  </>
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
              loadingFallback: <StudentTableSkeleton />,
              errorFallback,
              emptyTitle: tableState.hasActiveFilters
                ? "No matching student records"
                : "No student records yet",
              emptyDescription: tableState.hasActiveFilters
                ? "Try adjusting or clearing the current search and filters."
                : "Create a student to add the first record.",
              emptyAction: tableState.hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={tableState.reset}>
                  Clear filters
                </Button>
              ) : undefined,
            }}
          />
          <StudentDialogManager
            student={selectedStudent}
            dialog={dialog}
            onClose={() => {
              setSelectedStudent(null);
              setDialog(null);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
