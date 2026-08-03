"use client";

import {
  DataTableFacetedFilter,
  DataTableToolbar,
  type DataTableFilterOption,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useSubjectFilterOptions } from "@/hooks/subject.hook";
import type { ReactNode } from "react";

export const subjectFilterKeys = [
  "grade",
  "trackStrand",
  "semester",
] as const;

export type SubjectFilterKey = (typeof subjectFilterKeys)[number];

interface SubjectToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<SubjectFilterKey, string>;
  onFilterChange: (key: SubjectFilterKey, value: string) => void;
  canReset: boolean;
  onReset: () => void;
  isFetching: boolean;
  searchResetKey: number;
  actions?: ReactNode;
}

const semesterLabels: Record<string, string> = {
  FIRST: "First Semester",
  SECOND: "Second Semester",
};

export function SubjectToolbar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  canReset,
  onReset,
  isFetching,
  searchResetKey,
  actions,
}: SubjectToolbarProps) {
  const {
    data: options,
    isLoading,
    isError,
    isFetching: isFetchingOptions,
    refetch,
  } = useSubjectFilterOptions();
  const gradeOptions: DataTableFilterOption[] =
    options?.gradeLevels.map((grade) => ({
      label: `Grade ${grade}`,
      value: grade,
    })) ?? [];
  const trackStrandOptions: DataTableFilterOption[] =
    options?.trackStrands.map((trackStrand) => ({
      label: trackStrand,
      value: trackStrand,
    })) ?? [];
  const semesterOptions: DataTableFilterOption[] =
    options?.semesters.map((semester) => ({
      label: semesterLabels[semester] ?? semester,
      value: semester,
    })) ?? [];
  const hasSearchOrFilters =
    Boolean(search) || Object.values(filters).some(Boolean);

  return (
    <DataTableToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search code, description or track/strand..."
      searchResetKey={searchResetKey}
      canReset={canReset && hasSearchOrFilters}
      onReset={onReset}
      isFetching={isFetching}
      actions={actions}
    >
      <DataTableFacetedFilter
        label="Grade Level"
        allLabel="All Grade Levels"
        value={filters.grade}
        options={gradeOptions}
        onValueChange={(value) => onFilterChange("grade", value)}
        disabled={isLoading || isError}
      />
      <DataTableFacetedFilter
        label="Track / Strand"
        allLabel="All Tracks / Strands"
        value={filters.trackStrand}
        options={trackStrandOptions}
        onValueChange={(value) => onFilterChange("trackStrand", value)}
        disabled={isLoading || isError}
        className="sm:max-w-52"
      />
      <DataTableFacetedFilter
        label="Semester"
        allLabel="All Semesters"
        value={filters.semester}
        options={semesterOptions}
        onValueChange={(value) => onFilterChange("semester", value)}
        disabled={isLoading || isError}
      />
      {isError && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetchingOptions}
        >
          {isFetchingOptions ? "Retrying filters..." : "Retry filters"}
        </Button>
      )}
    </DataTableToolbar>
  );
}
