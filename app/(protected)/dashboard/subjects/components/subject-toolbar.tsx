"use client";

import {
  DataTableFacetedFilter,
  DataTableToolbar,
  type DataTableFilterOption,
} from "@/components/data-table";
import { useSubjectFilterOptions } from "@/hooks/subject.hook";
import type { ReactNode } from "react";

export const subjectFilterKeys = [
  "schoolLevel",
  "grade",
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
  } = useSubjectFilterOptions();
  const gradeOptions: DataTableFilterOption[] =
    options?.gradeLevels.map((grade) => ({
      label: `Grade ${grade}`,
      value: grade,
    })) ?? [];
  const hasSearchOrFilters =
    Boolean(search) || Object.values(filters).some(Boolean);

  return (
    <DataTableToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search code or description..."
      searchResetKey={searchResetKey}
      canReset={canReset && hasSearchOrFilters}
      onReset={onReset}
      isFetching={isFetching}
      actions={actions}
    >
      <DataTableFacetedFilter
        label="School Level"
        allLabel="JHS and SHS"
        value={filters.schoolLevel}
        options={[
          { label: "JHS - Grades 7-10", value: "JHS" },
          { label: "SHS - Grades 11-12", value: "SHS" },
        ]}
        onValueChange={(value) => {
          onFilterChange("schoolLevel", value);
          if (
            (value === "JHS" && ["11", "12"].includes(filters.grade)) ||
            (value === "SHS" && ["7", "8", "9", "10"].includes(filters.grade))
          ) {
            onFilterChange("grade", "");
          }
        }}
      />
      <DataTableFacetedFilter
        label="Grade Level"
        allLabel="All Grade Levels"
        value={filters.grade}
        options={gradeOptions.filter(({ value }) =>
          filters.schoolLevel === "JHS"
            ? ["7", "8", "9", "10"].includes(value)
            : filters.schoolLevel === "SHS"
              ? ["11", "12"].includes(value)
              : true,
        )}
        onValueChange={(value) => onFilterChange("grade", value)}
        disabled={isLoading || isError}
      />
    </DataTableToolbar>
  );
}
