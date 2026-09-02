"use client";

import { Suspense, useDeferredValue, useEffect, useEffectEvent, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { DataTable, DataTableFacetedFilter, DataTableToolbar, resolveServerPagination, type DataTableFilterOption } from "@/components/data-table";
import { SegmentedNavigation } from "@/components/common/segmented-navigation";
import { SubjectAssignmentTableSkeleton } from "@/components/skeletons/subject-assignment-table-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useAssignmentMatrix,
  useSubjectAssignmentHistory,
  useSubjectAssignmentHistoryFilterOptions,
  useSubjectAssignmentHistoryOptions,
} from "@/hooks/subject-assignment.hook";
import type { SubjectAssignmentHistoryItem, SubjectAssignmentHistoryQueryInput } from "@/schemas";
import { useTableUrlState } from "@/hooks/use-table-url-state.hook";

import { AssignmentMatrix } from "./components/assignment-matrix";
import { subjectAssignmentHistoryColumns } from "./components/subject-assignment-history-columns";
import { SubjectAssignmentHistoryViewDialog } from "./components/subject-assignment-history-view-dialog";

const historyFilterKeys = ["status", "academicYearId", "academicTermId", "teacherId", "sectionId", "subjectOfferingId"] as const;

export default function SubjectAssignmentsPage() {
  return (
    <Suspense fallback={<SubjectAssignmentTableSkeleton />}>
      <SubjectAssignmentsPageContent />
    </Suspense>
  );
}

function SubjectAssignmentsPageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "history" ? "history" : "matrix";
  const tableState = useTableUrlState({
    filterKeys: historyFilterKeys,
    sortableColumns: [],
    defaultPageSize: 25,
    pageSizeOptions: [25, 50],
  });
  const [gradeLevel, setGradeLevel] = useState<
    "7" | "8" | "9" | "10" | "11" | "12"
  >("7");
  const [termId, setTermId] = useState<string | null>(null);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [sectionSearch, setSectionSearch] = useState("");
  const [offeringSearch, setOfferingSearch] = useState("");
  const deferredTeacherSearch = useDeferredValue(teacherSearch);
  const deferredSectionSearch = useDeferredValue(sectionSearch);
  const deferredOfferingSearch = useDeferredValue(offeringSearch);
  const matrixQuery = useAssignmentMatrix({ gradeLevel });
  const [selectedAssignment, setSelectedAssignment] = useState<SubjectAssignmentHistoryItem | null>(null);
  const status = ["ACTIVE", "ARCHIVED"].includes(tableState.filters.status)
    ? tableState.filters.status as "ACTIVE" | "ARCHIVED"
    : undefined;
  const historyQuery: SubjectAssignmentHistoryQueryInput = {
    q: tableState.query.q?.trim().slice(0, 100) || undefined,
    status,
    academicYearId: tableState.filters.academicYearId || undefined,
    academicTermId: tableState.filters.academicTermId || undefined,
    teacherId: tableState.filters.teacherId || undefined,
    sectionId: tableState.filters.sectionId || undefined,
    subjectOfferingId: tableState.filters.subjectOfferingId || undefined,
    page: tableState.query.page,
    pageSize: tableState.query.pageSize,
  };
  const historyQueryResult = useSubjectAssignmentHistory(historyQuery, view === "history");
  const historyOptions = useSubjectAssignmentHistoryFilterOptions(
    { academicYearId: historyQuery.academicYearId },
    view === "history",
  );
  const teacherOptionsQuery = useSubjectAssignmentHistoryOptions({
    kind: "TEACHER",
    q: deferredTeacherSearch.trim() || undefined,
    selectedId: historyQuery.teacherId,
  }, view === "history");
  const sectionOptionsQuery = useSubjectAssignmentHistoryOptions({
    kind: "SECTION",
    q: deferredSectionSearch.trim() || undefined,
    selectedId: historyQuery.sectionId,
  }, view === "history");
  const offeringOptionsQuery = useSubjectAssignmentHistoryOptions({
    kind: "OFFERING",
    q: deferredOfferingSearch.trim() || undefined,
    selectedId: historyQuery.subjectOfferingId,
  }, view === "history");
  const selectedTerm = matrixQuery.data?.terms.find(
    (term) => term.id === termId,
  );
  const columns = useMemo(() => subjectAssignmentHistoryColumns({ onView: setSelectedAssignment }), []);
  const reconcilePage = useEffectEvent((page: number) => {
    tableState.onPaginationChange({ ...tableState.pagination, pageIndex: page - 1 });
  });
  const serverPagination = resolveServerPagination({
    requestedPagination: tableState.pagination,
    resolvedPage: historyQueryResult.data,
    isPlaceholderData: historyQueryResult.isPlaceholderData,
  });
  const hasFilters = Boolean(
    historyQuery.q || status || historyQuery.academicYearId || historyQuery.academicTermId || historyQuery.teacherId || historyQuery.sectionId || historyQuery.subjectOfferingId,
  );
  const academicYearOptions: DataTableFilterOption[] = historyOptions.data?.academicYears.map((year) => ({ label: year.label, value: year.id })) ?? [];
  const termOptions: DataTableFilterOption[] = historyOptions.data?.terms.map((term) => ({
    label: historyQuery.academicYearId ? term.name : `${term.academicYear.label} · ${term.name}`,
    value: term.id,
  })) ?? [];
  const teacherOptions = teacherOptionsQuery.data ?? [];
  const sectionOptions = sectionOptionsQuery.data ?? [];
  const offeringOptions = offeringOptionsQuery.data ?? [];
  const selectedTeacherLabel = teacherOptions.find((option) => option.id === historyQuery.teacherId)?.label;
  const selectedSectionLabel = sectionOptions.find((option) => option.id === historyQuery.sectionId)?.label;
  const selectedOfferingLabel = offeringOptions.find((option) => option.id === historyQuery.subjectOfferingId)?.label;

  useEffect(() => {
    if (historyQueryResult.data && serverPagination.shouldReconcile) {
      reconcilePage(historyQueryResult.data.page);
    }
  }, [historyQueryResult.data, serverPagination.shouldReconcile]);

  function setView(nextView: "matrix" | "history") {
    const params = new URLSearchParams(window.location.search);
    if (nextView === "history") params.set("view", "history");
    else params.delete("view");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Teaching Assignments</h1>
        <p className="text-sm text-muted-foreground">
          Review teaching coverage and assign Teachers by grade, Term, and
          Section.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
            <SegmentedNavigation ariaLabel="Teaching assignment view">
              <button
                type="button"
                aria-pressed={view === "matrix"}
                className={cn(
                  buttonVariants({
                    variant: view === "matrix" ? "secondary" : "ghost",
                    size: "sm",
                  }),
                )}
                  onClick={() => setView("matrix")}
              >
                Teaching Matrix
              </button>
              <button
                type="button"
                aria-pressed={view === "history"}
                className={cn(
                  buttonVariants({
                    variant: view === "history" ? "secondary" : "ghost",
                    size: "sm",
                  }),
                )}
                  onClick={() => setView("history")}
              >
                History
              </button>
            </SegmentedNavigation>
            {view === "matrix" && (
              <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-[minmax(9rem,auto)_minmax(12rem,auto)]">
                <div className="space-y-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor="assignment-grade"
                  >
                    Grade
                  </label>
                  <Select
                    value={gradeLevel}
                    onValueChange={(value) => {
                      setGradeLevel(value as typeof gradeLevel);
                      setTermId(null);
                    }}
                  >
                    <SelectTrigger
                      id="assignment-grade"
                      aria-label="Grade"
                      className="w-full min-w-32"
                    >
                      <SelectValue>Grade {gradeLevel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {["7", "8", "9", "10", "11", "12"].map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          Grade {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor="assignment-term"
                  >
                    Term focus
                  </label>
                  <Select
                    value={termId ?? "ALL"}
                    onValueChange={(value) =>
                      setTermId(value === "ALL" ? null : (value ?? null))
                    }
                  >
                    <SelectTrigger
                      id="assignment-term"
                      className="w-full min-w-48"
                    >
                      <SelectValue>
                        {termId
                          ? (selectedTerm?.name ?? "Selected Term")
                          : "All Terms"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Terms</SelectItem>
                      {matrixQuery.data?.terms.map((term) => (
                        <SelectItem key={term.id} value={term.id}>
                          {term.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          {view === "matrix" && (
            <div className="text-sm text-muted-foreground">
              {matrixQuery.data?.academicYear.label ?? "Active Academic Year"}
            </div>
          )}
          {view === "matrix" ? (
            matrixQuery.isLoading ? (
              <SubjectAssignmentTableSkeleton />
            ) : matrixQuery.isError ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Unable to load the teaching matrix.
              </div>
            ) : matrixQuery.data ? (
              <AssignmentMatrix matrix={matrixQuery.data} termId={termId} />
            ) : null
          ) : (
            <DataTable
              columns={columns}
              data={historyQueryResult.data?.items ?? []}
              onRowClick={setSelectedAssignment}
              toolbar={() => (
                <DataTableToolbar
                  search={tableState.search}
                  onSearchChange={tableState.setSearch}
                  searchPlaceholder="Search Teacher, Section, Offering, or Academic Year..."
                  searchResetKey={tableState.resetKey}
                  canReset={tableState.canReset}
                  onReset={tableState.reset}
                  isFetching={historyQueryResult.isFetching && !historyQueryResult.isLoading}
                >
                    <DataTableFacetedFilter
                    label="Status"
                    allLabel="All statuses"
                    value={tableState.filters.status}
                    options={[{ label: "Active", value: "ACTIVE" }, { label: "Archived", value: "ARCHIVED" }]}
                    onValueChange={(value) => tableState.setFilter("status", value)}
                  />
                  <DataTableFacetedFilter
                    label="Academic Year"
                    allLabel="All Academic Years"
                    value={tableState.filters.academicYearId}
                    options={academicYearOptions}
                    onValueChange={(value) => {
                      tableState.setFilter("academicYearId", value);
                      tableState.setFilter("academicTermId", "");
                    }}
                  />
                  <DataTableFacetedFilter
                    label="Term"
                    allLabel="All Terms"
                    value={tableState.filters.academicTermId}
                    options={termOptions}
                      onValueChange={(value) => tableState.setFilter("academicTermId", value)}
                    />
                    <SearchableSelect
                      ariaLabel="Teacher"
                      value={historyQuery.teacherId}
                      onValueChange={(value) => {
                        setTeacherSearch("");
                        tableState.setFilter("teacherId", value);
                      }}
                      options={teacherOptions.map((option) => ({ value: option.id, label: option.label, searchValue: option.searchValue }))}
                      placeholder="Search Teachers..."
                      inputValue={teacherSearch || selectedTeacherLabel || ""}
                      onInputValueChange={setTeacherSearch}
                      isLoading={teacherOptionsQuery.isLoading || teacherOptionsQuery.isFetching}
                      loadingLabel="Search Teachers..."
                      emptyLabel="No matching Teachers"
                      className="w-full min-w-48"
                    />
                    <SearchableSelect
                      ariaLabel="Section"
                      value={historyQuery.sectionId}
                      onValueChange={(value) => {
                        setSectionSearch("");
                        tableState.setFilter("sectionId", value);
                      }}
                      options={sectionOptions.map((option) => ({ value: option.id, label: option.label, searchValue: option.searchValue }))}
                      placeholder="Search Sections..."
                      inputValue={sectionSearch || selectedSectionLabel || ""}
                      onInputValueChange={setSectionSearch}
                      isLoading={sectionOptionsQuery.isLoading || sectionOptionsQuery.isFetching}
                      loadingLabel="Search Sections..."
                      emptyLabel="No matching Sections"
                      className="w-full min-w-48"
                    />
                    <SearchableSelect
                      ariaLabel="Offering"
                      value={historyQuery.subjectOfferingId}
                      onValueChange={(value) => {
                        setOfferingSearch("");
                        tableState.setFilter("subjectOfferingId", value);
                      }}
                      options={offeringOptions.map((option) => ({ value: option.id, label: option.label, searchValue: option.searchValue }))}
                      placeholder="Search Offerings..."
                      inputValue={offeringSearch || selectedOfferingLabel || ""}
                      onInputValueChange={setOfferingSearch}
                      isLoading={offeringOptionsQuery.isLoading || offeringOptionsQuery.isFetching}
                      loadingLabel="Search Offerings..."
                      emptyLabel="No matching Offerings"
                      className="w-full min-w-48"
                    />
                </DataTableToolbar>
              )}
              server={{
                pagination: serverPagination.pagination,
                sorting: tableState.sorting,
                pageCount: historyQueryResult.data?.pageCount ?? 0,
                totalCount: historyQueryResult.data?.totalCount ?? 0,
                onPaginationChange: tableState.onPaginationChange,
                onSortingChange: tableState.onSortingChange,
                pageSizeOptions: tableState.pageSizeOptions,
                disabled: historyQueryResult.isPlaceholderData,
              }}
              state={{
                isLoading: historyQueryResult.isLoading,
                isError: historyQueryResult.isError,
                isFetching: historyQueryResult.isFetching,
                loadingFallback: <SubjectAssignmentTableSkeleton />,
                errorFallback: <HistoryError onRetry={() => void historyQueryResult.refetch()} retrying={historyQueryResult.isFetching} />,
                emptyTitle: status === "ARCHIVED" && !historyQuery.q && !historyQuery.academicYearId && !historyQuery.academicTermId && !historyQuery.teacherId && !historyQuery.sectionId && !historyQuery.subjectOfferingId
                  ? "No archived teaching assignments found."
                  : hasFilters ? "No assignments match the current filters." : "No teaching assignment history found.",
                emptyDescription: hasFilters ? "Try adjusting or clearing the current search and filters." : "Teaching assignments will appear here when they are created.",
                emptyAction: hasFilters ? <Button variant="outline" size="sm" onClick={tableState.reset}>Clear filters</Button> : undefined,
              }}
            />
          )}
          <SubjectAssignmentHistoryViewDialog
            assignment={selectedAssignment}
            open={selectedAssignment !== null}
            onOpenChange={(open) => !open && setSelectedAssignment(null)}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
      <div className="space-y-1">
        <p className="font-medium">Unable to load teaching assignment history</p>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
      </div>
      <Button variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying ? "Retrying..." : "Try again"}
      </Button>
    </div>
  );
}
