"use client";

import { Suspense, useEffect, useEffectEvent, useMemo, useState } from "react";
import { Download } from "lucide-react";

import { DataTable, resolveServerPagination } from "@/components/data-table";
import { CrudToolbar } from "@/components/common/crud-toolbar";
import { AcademicConfigurationNav } from "@/components/common/academic-configuration-nav";
import { SubjectTableSkeleton } from "@/components/skeletons/subject-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubjects } from "@/hooks/subject.hook";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";
import { SUBJECTS_DESCRIPTION } from "@/lib/academic-configuration";
import {
  SubjectGradeLevelSchema,
  type SubjectListItem,
  type SubjectTableQueryInput,
} from "@/schemas";

import { CreateSubjectDialog } from "./components/create-subject-dialog";
import { SubjectImportDialog } from "./components/subject-import-dialog";
import {
  SubjectDialogManager,
  SubjectDialogType,
} from "./components/subject-dialog-manager";
import { subjectColumns } from "./components/subject-columns";
import {
  subjectFilterKeys,
  SubjectToolbar,
} from "./components/subject-toolbar";

const subjectSortFields = [
  "code",
  "description",
  "gradeLevel",
] as const;

export default function SubjectsPage() {
  return (
    <Suspense fallback={<SubjectTableSkeleton />}>
      <SubjectsPageContent />
    </Suspense>
  );
}

function SubjectsPageContent() {
  const tableState = useTableUrlState({
    filterKeys: subjectFilterKeys,
    sortableColumns: subjectSortFields,
  });
  const grade = SubjectGradeLevelSchema.safeParse(tableState.filters.grade);
  const schoolLevel = ["JHS", "SHS"].includes(tableState.filters.schoolLevel)
    ? (tableState.filters.schoolLevel as "JHS" | "SHS")
    : undefined;
  const search = tableState.query.q?.trim().slice(0, 100);
  const normalizeUrl = useEffectEvent(() => {
    if (tableState.filters.grade && !grade.success) {
      tableState.setFilter("grade", "");
    }

    if (tableState.filters.schoolLevel && !schoolLevel) {
      tableState.setFilter("schoolLevel", "");
    }

    if (
      grade.success &&
      ((schoolLevel === "JHS" && ["11", "12"].includes(grade.data)) ||
        (schoolLevel === "SHS" && ["7", "8", "9", "10"].includes(grade.data)))
    ) {
      tableState.setFilter("grade", "");
    }

    if (tableState.query.q !== search) {
      tableState.setSearch(search ?? "");
    }
  });
  const query: SubjectTableQueryInput = {
    q: search || undefined,
    schoolLevel,
    grade: grade.success ? grade.data : undefined,
    sort: tableState.query.sort as SubjectTableQueryInput["sort"],
    direction: tableState.query.direction as SubjectTableQueryInput["direction"],
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
  } = useSubjects(query);
  const [selectedSubject, setSelectedSubject] =
    useState<SubjectListItem | null>(null);
  const [dialog, setDialog] = useState<SubjectDialogType>(null);
  const columns = useMemo(
    () =>
      subjectColumns({
        onEdit: (subject) => {
          setSelectedSubject(subject);
          setDialog("edit");
        },
        onArchive: (subject) => {
          setSelectedSubject(subject);
          setDialog("archive");
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
    grade.success,
    schoolLevel,
    search,
    tableState.filters.grade,
    tableState.filters.schoolLevel,
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
        <p className="font-medium">Unable to load subject records</p>
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
          <h1 className="text-2xl font-semibold">Subjects</h1>
          <p className="text-sm text-muted-foreground">
            {SUBJECTS_DESCRIPTION}
          </p>
        </div>

        <CrudToolbar primaryAction={<CreateSubjectDialog />} />
      </div>

      <AcademicConfigurationNav current="Subjects" />

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-3">
        <div>
          <p className="font-medium">Reusable definition</p>
          <p className="text-muted-foreground">A Subject is not tied to an Academic Year.</p>
        </div>
        <div>
          <p className="font-medium">Curriculum is separate</p>
          <p className="text-muted-foreground">Add the Subject to Curriculum to offer it in a year and Terms.</p>
        </div>
        <div>
          <p className="font-medium">Enrollment is separate</p>
          <p className="text-muted-foreground">Creating a Subject never enrolls a student.</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            onRowClick={(subject) => {
              setSelectedSubject(subject);
              setDialog("view");
            }}
            toolbar={() => (
              <SubjectToolbar
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
                    <SubjectImportDialog
                      trigger={<Button variant="outline">Import Subject</Button>}
                    />
                    <Button variant="outline" disabled>
                      <Download />
                      Export
                    </Button>
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
              loadingFallback: <SubjectTableSkeleton />,
              errorFallback,
              emptyTitle: tableState.hasActiveFilters
                ? "No matching subject records"
                : "No subject records yet",
              emptyDescription: tableState.hasActiveFilters
                ? "Try adjusting or clearing the current search and filters."
                : "Create a subject to add the first record.",
              emptyAction: tableState.hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={tableState.reset}>
                  Clear filters
                </Button>
              ) : undefined,
            }}
          />
          <SubjectDialogManager
            subject={selectedSubject}
            dialog={dialog}
            onClose={() => {
              setSelectedSubject(null);
              setDialog(null);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
