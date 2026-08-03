"use client";

import {
  DataTableFacetedFilter,
  DataTableToolbar,
  type DataTableFilterOption,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useStudentFilterOptions } from "@/hooks/student.hook";
import type { ReactNode } from "react";

export const studentFilterKeys = [
  "status",
  "gender",
  "grade",
  "sectionId",
] as const;

export type StudentFilterKey = (typeof studentFilterKeys)[number];

interface StudentToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<StudentFilterKey, string>;
  onFilterChange: (key: StudentFilterKey, value: string) => void;
  canReset: boolean;
  onReset: () => void;
  isFetching: boolean;
  searchResetKey: number;
  actions?: ReactNode;
}

const statusLabels: Record<string, string> = {
  UNENROLLED: "Unenrolled",
  ENROLLED: "Enrolled",
  GRADUATED: "Graduated",
  TRANSFERRED: "Transferred",
  DROPPED: "Dropped",
};

const genderLabels: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
};

export function StudentToolbar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  canReset,
  onReset,
  isFetching,
  searchResetKey,
  actions,
}: StudentToolbarProps) {
  const {
    data: options,
    isLoading,
    isError,
    isFetching: isFetchingOptions,
    refetch,
  } = useStudentFilterOptions();
  const statusOptions: DataTableFilterOption[] =
    options?.statuses.map((status) => ({
      label: statusLabels[status] ?? status,
      value: status,
    })) ?? [];
  const genderOptions: DataTableFilterOption[] =
    options?.genders.map((gender) => ({
      label: genderLabels[gender] ?? gender,
      value: gender,
    })) ?? [];
  const gradeOptions: DataTableFilterOption[] =
    options?.gradeLevels.map((grade) => ({
      label: `Grade ${grade}`,
      value: grade,
    })) ?? [];
  const sectionOptions: DataTableFilterOption[] =
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
      searchPlaceholder="Search LRN or student name..."
      searchResetKey={searchResetKey}
      canReset={canReset && hasSearchOrFilters}
      onReset={onReset}
      isFetching={isFetching}
      actions={actions}
    >
      <DataTableFacetedFilter
        label="Status"
        allLabel="All Statuses"
        value={filters.status}
        options={statusOptions}
        onValueChange={(value) => onFilterChange("status", value)}
        disabled={isLoading || isError}
      />
      <DataTableFacetedFilter
        label="Gender"
        allLabel="All Genders"
        value={filters.gender}
        options={genderOptions}
        onValueChange={(value) => onFilterChange("gender", value)}
        disabled={isLoading || isError}
      />
      <DataTableFacetedFilter
        label="Grade Level"
        allLabel="All Grade Levels"
        value={filters.grade}
        options={gradeOptions}
        onValueChange={(value) => onFilterChange("grade", value)}
        disabled={isLoading || isError}
      />
      <DataTableFacetedFilter
        label="Current Section"
        allLabel="All Sections"
        value={filters.sectionId}
        options={sectionOptions}
        onValueChange={(value) => onFilterChange("sectionId", value)}
        disabled={isLoading || isError}
        className="sm:max-w-52"
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
