"use client";

import type { ReactNode } from "react";

import {
  DataTableFacetedFilter,
  DataTableToolbar,
  type DataTableFilterOption,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useSectionFilterOptions } from "@/hooks/section.hook";
import { formatFullName } from "@/lib/format";

export const sectionFilterKeys = [
  "grade",
  "shift",
  "adviserId",
] as const;

export type SectionFilterKey = (typeof sectionFilterKeys)[number];

interface SectionToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<SectionFilterKey, string>;
  onFilterChange: (key: SectionFilterKey, value: string) => void;
  canReset: boolean;
  onReset: () => void;
  isFetching: boolean;
  searchResetKey: number;
  actions?: ReactNode;
}

const shiftLabels: Record<string, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
};

export function SectionToolbar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  canReset,
  onReset,
  isFetching,
  searchResetKey,
  actions,
}: SectionToolbarProps) {
  const {
    data: options,
    isLoading,
    isError,
    isFetching: isFetchingOptions,
    refetch,
  } = useSectionFilterOptions();
  const gradeOptions: DataTableFilterOption[] =
    options?.gradeLevels.map((grade) => ({
      label: `Grade ${grade}`,
      value: grade,
    })) ?? [];
  const shiftOptions: DataTableFilterOption[] =
    options?.shifts.map((shift) => ({
      label: shiftLabels[shift] ?? shift,
      value: shift,
    })) ?? [];
  const adviserOptions: DataTableFilterOption[] =
    options?.advisers.map((adviser) => ({
      label: formatFullName(
        adviser.firstName,
        adviser.middleName,
        adviser.lastName,
      ),
      value: adviser.id,
    })) ?? [];
  const hasSearchOrFilters =
    Boolean(search) || Object.values(filters).some(Boolean);

  return (
    <DataTableToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search section, room or adviser..."
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
        label="Shift"
        allLabel="All Shifts"
        value={filters.shift}
        options={shiftOptions}
        onValueChange={(value) => onFilterChange("shift", value)}
        disabled={isLoading || isError}
      />
      <DataTableFacetedFilter
        label="Adviser"
        allLabel="All Advisers"
        value={filters.adviserId}
        options={adviserOptions}
        onValueChange={(value) => onFilterChange("adviserId", value)}
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
