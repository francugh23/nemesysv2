"use client";

import {
  DataTableFacetedFilter,
  DataTableToolbar,
  type DataTableFilterOption,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useEnrollmentFilterOptions } from "@/hooks/enrollment.hook";

export const enrollmentFilterKeys = [
  "status",
  "gradeLevel",
  "academicYear",
  "sectionId",
  "semester",
] as const;

export type EnrollmentFilterKey = (typeof enrollmentFilterKeys)[number];

interface EnrollmentToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<EnrollmentFilterKey, string>;
  onFilterChange: (key: EnrollmentFilterKey, value: string) => void;
  canReset: boolean;
  onReset: () => void;
  isFetching: boolean;
  searchResetKey: number;
}

const statusOptions: DataTableFilterOption[] = [
  { label: "Active", value: "ACTIVE" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Transferred", value: "TRANSFERRED" },
  { label: "Dropped", value: "DROPPED" },
];

const semesterOptions: DataTableFilterOption[] = [
  { label: "First", value: "FIRST" },
  { label: "Second", value: "SECOND" },
  { label: "No semester", value: "NONE" },
];

export function EnrollmentToolbar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  canReset,
  onReset,
  isFetching,
  searchResetKey,
}: EnrollmentToolbarProps) {
  const {
    data: options,
    isLoading,
    isError,
    isFetching: isFetchingOptions,
    refetch,
  } = useEnrollmentFilterOptions();
  const gradeOptions =
    options?.gradeLevels.map((gradeLevel) => ({
      label: `Grade ${gradeLevel}`,
      value: gradeLevel,
    })) ?? [];
  const academicYearOptions =
    options?.academicYears.map((academicYear) => ({
      label: academicYear,
      value: academicYear,
    })) ?? [];
  const sectionOptions =
    options?.sections.map((section) => ({
      label: `Grade ${section.gradeLevel}${section.trackStrand ? ` - ${section.trackStrand}` : ""} - ${section.sectionName}`,
      value: section.id,
    })) ?? [];
  const hasSearchOrFilters =
    Boolean(search) || Object.values(filters).some(Boolean);

  return (
    <DataTableToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search students..."
      searchResetKey={searchResetKey}
      canReset={canReset && hasSearchOrFilters}
      onReset={onReset}
      isFetching={isFetching}
    >
      <DataTableFacetedFilter
        label="Status"
        allLabel="All Statuses"
        value={filters.status}
        options={statusOptions}
        onValueChange={(value) => onFilterChange("status", value)}
      />
      <DataTableFacetedFilter
        label="Grade Level"
        allLabel="All Grade Levels"
        value={filters.gradeLevel}
        options={gradeOptions}
        onValueChange={(value) => onFilterChange("gradeLevel", value)}
        disabled={isLoading || isError}
      />
      <DataTableFacetedFilter
        label="Section"
        allLabel="All Sections"
        value={filters.sectionId}
        options={sectionOptions}
        onValueChange={(value) => onFilterChange("sectionId", value)}
        disabled={isLoading || isError}
        className="sm:max-w-52"
      />
      <DataTableFacetedFilter
        label="Academic Year"
        allLabel="All Academic Years"
        value={filters.academicYear}
        options={academicYearOptions}
        onValueChange={(value) => onFilterChange("academicYear", value)}
        disabled={isLoading || isError}
      />
      <DataTableFacetedFilter
        label="Semester"
        allLabel="All Semesters"
        value={filters.semester}
        options={semesterOptions}
        onValueChange={(value) => onFilterChange("semester", value)}
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
