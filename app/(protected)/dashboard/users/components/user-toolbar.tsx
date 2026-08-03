"use client";

import type { ReactNode } from "react";

import {
  DataTableFacetedFilter,
  DataTableToolbar,
  type DataTableFilterOption,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { useUserFilterOptions } from "@/hooks/user.hook";

export const userFilterKeys = ["role", "status", "firstLogin"] as const;

export type UserFilterKey = (typeof userFilterKeys)[number];

interface UserToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<UserFilterKey, string>;
  onFilterChange: (key: UserFilterKey, value: string) => void;
  canReset: boolean;
  onReset: () => void;
  isFetching: boolean;
  searchResetKey: number;
  actions?: ReactNode;
}

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  REGISTRAR: "Registrar",
  PRINCIPAL: "Principal",
  TEACHER: "Teacher",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

export function UserToolbar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  canReset,
  onReset,
  isFetching,
  searchResetKey,
  actions,
}: UserToolbarProps) {
  const {
    data: options,
    isLoading,
    isError,
    isFetching: isFetchingOptions,
    refetch,
  } = useUserFilterOptions();
  const roleOptions: DataTableFilterOption[] =
    options?.roles.map((role) => ({
      label: roleLabels[role] ?? role,
      value: role,
    })) ?? [];
  const statusOptions: DataTableFilterOption[] =
    options?.statuses.map((status) => ({
      label: statusLabels[status] ?? status,
      value: status,
    })) ?? [];
  const firstLoginOptions: DataTableFilterOption[] =
    options?.firstLoginValues.map((isFirstLogin) => ({
      label: isFirstLogin ? "Required" : "Completed",
      value: String(isFirstLogin),
    })) ?? [];
  const hasSearchOrFilters =
    Boolean(search) || Object.values(filters).some(Boolean);

  return (
    <DataTableToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search employee no., username, email or name..."
      searchResetKey={searchResetKey}
      canReset={canReset && hasSearchOrFilters}
      onReset={onReset}
      isFetching={isFetching}
      actions={actions}
    >
      <DataTableFacetedFilter
        label="Role"
        allLabel="All Roles"
        value={filters.role}
        options={roleOptions}
        onValueChange={(value) => onFilterChange("role", value)}
        disabled={isLoading || isError}
      />
      <DataTableFacetedFilter
        label="Status"
        allLabel="All Statuses"
        value={filters.status}
        options={statusOptions}
        onValueChange={(value) => onFilterChange("status", value)}
        disabled={isLoading || isError}
      />
      <DataTableFacetedFilter
        label="First Login"
        allLabel="All First Login States"
        value={filters.firstLogin}
        options={firstLoginOptions}
        onValueChange={(value) => onFilterChange("firstLogin", value)}
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
