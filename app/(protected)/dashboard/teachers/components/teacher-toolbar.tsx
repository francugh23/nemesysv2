"use client";

import type { ReactNode } from "react";

import {
  DataTableFacetedFilter,
  DataTableToolbar,
  type DataTableFilterOption,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useTeacherFilterOptions } from "@/hooks/teacher.hook";

export const teacherFilterKeys = ["status", "gender", "adviser"] as const;

export type TeacherFilterKey = (typeof teacherFilterKeys)[number];

interface TeacherToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<TeacherFilterKey, string>;
  onFilterChange: (key: TeacherFilterKey, value: string) => void;
  canReset: boolean;
  onReset: () => void;
  isFetching: boolean;
  searchResetKey: number;
  actions?: ReactNode;
}

const statusLabels: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

const genderLabels: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
};

export function TeacherToolbar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  canReset,
  onReset,
  isFetching,
  searchResetKey,
  actions,
}: TeacherToolbarProps) {
  const {
    data: options,
    isLoading,
    isError,
    isFetching: isFetchingOptions,
    refetch,
  } = useTeacherFilterOptions();
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
  const hasSearchOrFilters =
    Boolean(search) || Object.values(filters).some(Boolean);

  return (
    <DataTableToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search employee number or teacher name..."
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
        label="Adviser"
        allLabel="All Teachers"
        value={filters.adviser}
        options={[{ label: "Has active section", value: "true" }, { label: "No active section", value: "false" }]}
        onValueChange={(value) => onFilterChange("adviser", value)}
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
