"use client";

import { Suspense, useEffect, useEffectEvent, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { AcademicConfigurationNav } from "@/components/common/academic-configuration-nav";
import { DataTable, DataTableFacetedFilter, DataTableToolbar, resolveServerPagination, type DataTableFilterOption } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSubjectOfferingFilterOptions, useSubjectOfferings } from "@/hooks/subject-offering.hook";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";
import {
  CURRICULUM_DESCRIPTION,
  CURRICULUM_TITLE,
} from "@/lib/academic-configuration";
import type { SubjectOfferingTableQueryInput } from "@/schemas";

import { subjectOfferingColumns } from "./components/subject-offering-columns";
import {
  ArchiveSubjectOfferingDialog,
  ApproveShsSubjectOfferingDialog,
  CreateSubjectOfferingDialog,
  EditSubjectOfferingDialog,
} from "./components/subject-offering-dialogs";
import { ShsCurriculumClusterDialog } from "./components/shs-curriculum-cluster-dialog";
import { ShsCurriculumReferenceTable } from "./components/shs-curriculum-reference-table";
import type { SubjectOfferingListItem } from "./components/subject-offering-types";

const filterKeys = ["academicYearId", "gradeLevel", "curriculumStatus"] as const;

export default function SubjectOfferingsPage() {
  return (
    <Suspense fallback={<LoadingTable />}>
      <SubjectOfferingsPageContent />
    </Suspense>
  );
}

function SubjectOfferingsPageContent() {
  const { data: session } = useSession();
  const canManageOfferings = session?.user.role === "SUPER_ADMIN";
  const tableState = useTableUrlState({ filterKeys, sortableColumns: [] });
  const { data: filterOptions } = useSubjectOfferingFilterOptions();
  const gradeLevel = ["7", "8", "9", "10", "11", "12"].includes(tableState.filters.gradeLevel)
    ? tableState.filters.gradeLevel as SubjectOfferingTableQueryInput["gradeLevel"]
    : undefined;
  const academicYearId = tableState.filters.academicYearId || undefined;
  const search = tableState.query.q?.trim().slice(0, 100);
  const curriculumStatus = ["PROVISIONAL_DEPED", "SCHOOL_APPROVED"].includes(tableState.filters.curriculumStatus)
    ? tableState.filters.curriculumStatus as "PROVISIONAL_DEPED" | "SCHOOL_APPROVED"
    : undefined;
  const isShsGrade = gradeLevel === "11" || gradeLevel === "12";
  const query: SubjectOfferingTableQueryInput = {
    q: search || undefined,
    academicYearId,
    gradeLevel,
    curriculumStatus,
    page: tableState.query.page,
    pageSize: tableState.query.pageSize,
  };
  const { data, isLoading, isError, isFetching, isPlaceholderData, refetch } = useSubjectOfferings(query);
  const [selectedOffering, setSelectedOffering] = useState<SubjectOfferingListItem | null>(null);
  const [dialog, setDialog] = useState<"edit" | "archive" | "approve" | null>(null);
  const columns = useMemo(
    () =>
      subjectOfferingColumns({
        onEdit: (offering) => {
          setSelectedOffering(offering);
          setDialog("edit");
        },
        onArchive: (offering) => {
          setSelectedOffering(offering);
          setDialog("archive");
        },
        onApprove: (offering) => { setSelectedOffering(offering); setDialog("approve"); },
        canManageOfferings,
      }),
    [canManageOfferings],
  );
  const reconcilePage = useEffectEvent((page: number) => {
    tableState.onPaginationChange({ ...tableState.pagination, pageIndex: page - 1 });
  });
  const normalizeGradeFilter = useEffectEvent(() => {
    if (tableState.filters.gradeLevel && !gradeLevel) {
      tableState.setFilter("gradeLevel", "");
    }
    if (tableState.filters.curriculumStatus && !isShsGrade) {
      tableState.setFilter("curriculumStatus", "");
    }
  });
  const serverPagination = resolveServerPagination({
    requestedPagination: tableState.pagination,
    resolvedPage: data,
    isPlaceholderData,
  });

  useEffect(() => {
    normalizeGradeFilter();
  }, [gradeLevel, isShsGrade, tableState.filters.curriculumStatus, tableState.filters.gradeLevel]);

  useEffect(() => {
    if (data && serverPagination.shouldReconcile) {
      reconcilePage(data.page);
    }
  }, [data, serverPagination.shouldReconcile]);

  const academicYearOptions: DataTableFilterOption[] = filterOptions?.academicYears.map((year) => ({
    label: year.label,
    value: year.id,
  })) ?? [];
  const gradeOptions: DataTableFilterOption[] = ["7", "8", "9", "10", "11", "12"].map((grade) => ({
    label: `Grade ${grade}`,
    value: grade,
  }));
  const hasFilters = Boolean(search || academicYearId || gradeLevel || curriculumStatus);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{CURRICULUM_TITLE}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {CURRICULUM_DESCRIPTION}
          </p>
          <p className="text-xs text-muted-foreground">
            Subject = reusable definition. Curriculum = Academic-Year-specific Subject Offering.
            Active SHS entries also show classification, school-facing context, and approval status.
          </p>
        </div>
        {canManageOfferings && <CrudToolbar primaryAction={<CreateSubjectOfferingDialog />} actions={<ShsCurriculumClusterDialog />} />}
      </div>

      <AcademicConfigurationNav
        current="Curriculum"
        showSubjects={session?.user.role === "SUPER_ADMIN"}
      />

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            toolbar={() => (
              <DataTableToolbar
                search={tableState.search}
                onSearchChange={tableState.setSearch}
                searchPlaceholder="Search code or description..."
                searchResetKey={tableState.resetKey}
                canReset={hasFilters}
                onReset={tableState.reset}
                isFetching={isFetching && !isLoading}
              >
                <DataTableFacetedFilter
                  label="Academic Year"
                  allLabel="All Academic Years"
                  value={tableState.filters.academicYearId}
                  options={academicYearOptions}
                  onValueChange={(value) => tableState.setFilter("academicYearId", value)}
                />
                {isShsGrade && (
                  <DataTableFacetedFilter
                    label="SHS Approval Status"
                    allLabel="All SHS Approval Statuses"
                    value={tableState.filters.curriculumStatus}
                    options={[{ label: "Provisional DepEd", value: "PROVISIONAL_DEPED" }, { label: "School Approved", value: "SCHOOL_APPROVED" }]}
                    onValueChange={(value) => tableState.setFilter("curriculumStatus", value)}
                  />
                )}
                <DataTableFacetedFilter
                  label="Grade / Level"
                  allLabel="JHS and SHS"
                  value={tableState.filters.gradeLevel}
                  options={gradeOptions.map((option) => ({
                    ...option,
                    label: `${["7", "8", "9", "10"].includes(option.value) ? "JHS" : "SHS"} - ${option.label}`,
                  }))}
                  onValueChange={(value) => {
                    tableState.setFilter("gradeLevel", value);
                    if (!["11", "12"].includes(value)) {
                      tableState.setFilter("curriculumStatus", "");
                    }
                  }}
                />
              </DataTableToolbar>
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
              loadingFallback: <LoadingTable />,
              errorFallback: <ErrorTable onRetry={() => void refetch()} retrying={isFetching} />,
              emptyTitle: hasFilters ? "No matching Curriculum entries" : "No Curriculum entries yet",
              emptyDescription: hasFilters
                ? "Try adjusting or clearing the current search and filters."
                : "Create a Subject Offering to add the first Curriculum entry.",
              emptyAction: hasFilters ? <Button variant="outline" size="sm" onClick={tableState.reset}>Clear filters</Button> : undefined,
            }}
          />
          {selectedOffering && (
            <>
              <EditSubjectOfferingDialog offering={selectedOffering} open={dialog === "edit"} onOpenChange={(open) => !open && setDialog(null)} />
               <ArchiveSubjectOfferingDialog offering={selectedOffering} open={dialog === "archive"} onOpenChange={(open) => !open && setDialog(null)} />
               <ApproveShsSubjectOfferingDialog offering={selectedOffering} open={dialog === "approve"} onOpenChange={(open) => !open && setDialog(null)} />
            </>
          )}
        </CardContent>
      </Card>
      <details className="rounded-xl border bg-card text-card-foreground shadow-sm">
        <summary className="cursor-pointer list-none p-6">
          <h2 className="font-semibold">DepEd Reference Catalog (reference only)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Provenance candidates are not operational Curriculum, school-approved Subject Offerings, or student selections. Expand to review reference evidence.
          </p>
        </summary>
        <div className="border-t p-6 pt-4">
          <ShsCurriculumReferenceTable />
        </div>
      </details>
    </div>
  );
}

function LoadingTable() {
  return <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Loading Curriculum...</div>;
}

function ErrorTable({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
      <div><p className="font-medium">Unable to load Curriculum</p><p className="text-sm text-muted-foreground">Check your connection and try again.</p></div>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>{retrying ? "Retrying..." : "Try again"}</Button>
    </div>
  );
}
