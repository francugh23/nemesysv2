"use client";

import { Suspense, useEffect, useEffectEvent, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { DataTable, DataTableFacetedFilter, type DataTableFilterOption } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useShsCurriculumReferences, useSubjectOfferingOptions, useSubjectOfferings } from "@/hooks/subject-offering.hook";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";
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
  const { data: options } = useSubjectOfferingOptions();
  const gradeLevel = ["7", "8", "9", "10", "11", "12"].includes(tableState.filters.gradeLevel)
    ? tableState.filters.gradeLevel
    : undefined;
  const academicYearId = tableState.filters.academicYearId || undefined;
  const curriculumStatus = ["PROVISIONAL_DEPED", "SCHOOL_APPROVED"].includes(tableState.filters.curriculumStatus)
    ? tableState.filters.curriculumStatus as "PROVISIONAL_DEPED" | "SCHOOL_APPROVED"
    : undefined;
  const query: SubjectOfferingTableQueryInput = {
    academicYearId,
    gradeLevel,
    curriculumStatus,
    page: tableState.query.page,
    pageSize: tableState.query.pageSize,
  };
  const { data, isLoading, isError, isFetching, isPlaceholderData, refetch } = useSubjectOfferings(query);
  const { data: references = [] } = useShsCurriculumReferences();
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
  });
  const displayedPagination = isPlaceholderData && data
    ? { pageIndex: data.page - 1, pageSize: Number(data.pageSize) }
    : tableState.pagination;

  useEffect(() => {
    normalizeGradeFilter();
  }, [gradeLevel, tableState.filters.gradeLevel]);

  useEffect(() => {
    if (data && !isPlaceholderData && data.page !== tableState.pagination.pageIndex + 1) {
      reconcilePage(data.page);
    }
  }, [data, isPlaceholderData, tableState.pagination.pageIndex]);

  const academicYearOptions: DataTableFilterOption[] = options?.academicYears.map((year) => ({
    label: year.label,
    value: year.id,
  })) ?? [];
  const gradeOptions: DataTableFilterOption[] = ["7", "8", "9", "10", "11", "12"].map((grade) => ({
    label: `Grade ${grade}`,
    value: grade,
  }));
  const hasFilters = Boolean(academicYearId || gradeLevel || curriculumStatus);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Subject Offerings</h1>
          <p className="text-sm text-muted-foreground">Review offering configuration and provisional DepEd reference candidates. Provisional records do not establish NVGCHS availability.</p>
        </div>
        {canManageOfferings && <CrudToolbar primaryAction={<CreateSubjectOfferingDialog />} actions={<ShsCurriculumClusterDialog />} />}
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            toolbar={() => (
              <div className="flex flex-wrap items-center gap-2">
                <DataTableFacetedFilter
                  label="Academic Year"
                  allLabel="All Academic Years"
                  value={tableState.filters.academicYearId}
                  options={academicYearOptions}
                  onValueChange={(value) => tableState.setFilter("academicYearId", value)}
                />
                <DataTableFacetedFilter
                  label="Curriculum Status"
                  allLabel="All Statuses"
                  value={tableState.filters.curriculumStatus}
                  options={[{ label: "Provisional DepEd", value: "PROVISIONAL_DEPED" }, { label: "School Approved", value: "SCHOOL_APPROVED" }]}
                  onValueChange={(value) => tableState.setFilter("curriculumStatus", value)}
                />
                <DataTableFacetedFilter
                  label="Grade Level"
                  allLabel="All Grade Levels"
                  value={tableState.filters.gradeLevel}
                  options={gradeOptions}
                  onValueChange={(value) => tableState.setFilter("gradeLevel", value)}
                />
                {hasFilters && <Button variant="ghost" size="sm" onClick={tableState.reset}>Reset</Button>}
                {isFetching && !isLoading && <span className="text-xs text-muted-foreground">Updating</span>}
              </div>
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
              loadingFallback: <LoadingTable />,
              errorFallback: <ErrorTable onRetry={() => void refetch()} retrying={isFetching} />,
              emptyTitle: hasFilters ? "No matching subject offerings" : "No subject offerings yet",
              emptyDescription: hasFilters
                ? "Try adjusting or clearing the current filters."
                : "Create a subject offering to add the first record.",
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
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div><h2 className="font-semibold">Provisional DepEd Reference Catalog</h2><p className="text-sm text-muted-foreground">Reference candidates only. Records without term evidence are not Subject Offerings and cannot be selected for students.</p></div>
          <ShsCurriculumReferenceTable references={references} />
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingTable() {
  return <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">Loading subject offerings...</div>;
}

function ErrorTable({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
      <div><p className="font-medium">Unable to load subject offerings</p><p className="text-sm text-muted-foreground">Check your connection and try again.</p></div>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>{retrying ? "Retrying..." : "Try again"}</Button>
    </div>
  );
}
