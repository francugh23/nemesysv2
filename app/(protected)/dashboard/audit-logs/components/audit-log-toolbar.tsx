"use client";

import type { ReactNode } from "react";
import { CalendarDays, X } from "lucide-react";
import { useState } from "react";

import {
  DataTableFacetedFilter,
  DataTableToolbar,
  type DataTableFilterOption,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuditLogFilterOptions } from "@/hooks/audit.hook";
import { formatFullName } from "@/lib/format";

export const auditLogFilterKeys = [
  "module",
  "action",
  "actor",
  "dateFrom",
  "dateTo",
] as const;

const PHILIPPINE_TIME_ZONE = "Asia/Manila";

function parseDateValue(value: string) {
  if (!value) return undefined;

  return new Date(`${value}T00:00:00.000+08:00`);
}

function formatDateValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: PHILIPPINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: PHILIPPINE_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function AuditLogDatePicker({
  label,
  value,
  onValueChange,
}: {
  label: "From" | "To";
  value: string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={`${label} date`}
        render={
          <Button
            variant="outline"
            data-empty={!selectedDate}
            className="h-8 w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground md:w-36"
          />
        }
      >
        <CalendarDays />
        {selectedDate ? formatDateLabel(selectedDate) : `${label} date`}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => {
            onValueChange(date ? formatDateValue(date) : "");
            setOpen(false);
          }}
          timeZone={PHILIPPINE_TIME_ZONE}
        />
        {value && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onValueChange("");
                setOpen(false);
              }}
            >
              <X />
              Clear {label.toLowerCase()} date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export type AuditLogFilterKey = (typeof auditLogFilterKeys)[number];

interface AuditLogToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: Record<AuditLogFilterKey, string>;
  onFilterChange: (key: AuditLogFilterKey, value: string) => void;
  canReset: boolean;
  onReset: () => void;
  isFetching: boolean;
  searchResetKey: number;
  actions?: ReactNode;
}

export function AuditLogToolbar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  canReset,
  onReset,
  isFetching,
  searchResetKey,
  actions,
}: AuditLogToolbarProps) {
  const {
    data: options,
    isLoading,
    isError,
    isFetching: isFetchingOptions,
    refetch,
  } = useAuditLogFilterOptions();
  const moduleOptions: DataTableFilterOption[] =
    options?.modules.map((module) => ({ label: module, value: module })) ?? [];
  const actionOptions: DataTableFilterOption[] =
    options?.actions.map((action) => ({ label: action, value: action })) ?? [];
  const actorOptions: DataTableFilterOption[] =
    options?.actors.map((actor) => ({
      label: `${formatFullName(actor.firstName, actor.middleName, actor.lastName)} (${actor.username})`,
      value: actor.id,
    })) ?? [];
  const hasSearchOrFilters =
    Boolean(search) || Object.values(filters).some(Boolean);

  return (
    <DataTableToolbar
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Search actor, module, action, record or description..."
      searchResetKey={searchResetKey}
      canReset={canReset && hasSearchOrFilters}
      onReset={onReset}
      isFetching={isFetching}
      actions={actions}
    >
      <DataTableFacetedFilter
        label="Module"
        allLabel="All Modules"
        value={filters.module}
        options={moduleOptions}
        onValueChange={(value) => onFilterChange("module", value)}
        disabled={isLoading || isError}
      />
      <DataTableFacetedFilter
        label="Action"
        allLabel="All Actions"
        value={filters.action}
        options={actionOptions}
        onValueChange={(value) => onFilterChange("action", value)}
        disabled={isLoading || isError}
      />
      <DataTableFacetedFilter
        label="Actor"
        allLabel="All Actors"
        value={filters.actor}
        options={actorOptions}
        onValueChange={(value) => onFilterChange("actor", value)}
        disabled={isLoading || isError}
        className="sm:max-w-56"
      />
      <AuditLogDatePicker
        label="From"
        value={filters.dateFrom}
        onValueChange={(value) => onFilterChange("dateFrom", value)}
      />
      <AuditLogDatePicker
        label="To"
        value={filters.dateTo}
        onValueChange={(value) => onFilterChange("dateTo", value)}
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
