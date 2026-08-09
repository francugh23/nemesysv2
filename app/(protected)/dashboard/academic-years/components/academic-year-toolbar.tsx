"use client";

import {
  DataTableFacetedFilter,
  DataTableToolbar,
  type DataTableFilterOption,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useAcademicYearFilterOptions } from "@/hooks/academic-year.hook";

export const academicYearFilterKeys = ["status"] as const;

type AcademicYearFilterKey = (typeof academicYearFilterKeys)[number];

interface AcademicYearToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<AcademicYearFilterKey, string>;
  onFilterChange: (key: AcademicYearFilterKey, value: string) => void;
  canReset: boolean;
  onReset: () => void;
  isFetching: boolean;
  searchResetKey: number;
}

export function AcademicYearToolbar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  canReset,
  onReset,
  isFetching,
  searchResetKey,
}: AcademicYearToolbarProps) {
  const {
    data: options,
    isLoading,
    isError,
    isFetching: isFetchingOptions,
    refetch,
  } = useAcademicYearFilterOptions();
  const statusOptions: DataTableFilterOption[] =
    options?.statuses.map((status) => ({
      label: status.charAt(0) + status.slice(1).toLowerCase(),
      value: status,
    })) ?? [];
  const hasSearchOrFilters = Boolean(search) || Boolean(filters.status);

  return (
    <DataTableToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search academic year..."
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
