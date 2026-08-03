"use client";

import { LoaderCircle, X } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DataTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  searchDebounceMs?: number;
  searchResetKey?: string | number;
  canReset?: boolean;
  onReset?: () => void;
  isFetching?: boolean;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchDebounceMs = 300,
  searchResetKey = 0,
  canReset = false,
  onReset,
  isFetching = false,
  children,
  actions,
}: DataTableToolbarProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <DebouncedSearchInput
          key={`${search}-${searchResetKey}`}
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          debounceMs={searchDebounceMs}
        />

        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          {children}
          {onReset && canReset && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <X />
              Reset
            </Button>
          )}
          {isFetching && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <LoaderCircle className="size-3.5 animate-spin" />
              Updating
            </span>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

function DebouncedSearchInput({
  value,
  onChange,
  placeholder,
  debounceMs,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  debounceMs: number;
}) {
  const [input, setInput] = useState(value);
  const notifyChange = useEffectEvent(onChange);

  useEffect(() => {
    if (input === value) {
      return;
    }

    const timeout = window.setTimeout(() => {
      notifyChange(input);
    }, debounceMs);

    return () => window.clearTimeout(timeout);
  }, [debounceMs, input, value]);

  return (
    <Input
      placeholder={placeholder}
      value={input}
      onChange={(event) => setInput(event.target.value)}
      className="w-full lg:min-w-64 lg:flex-1"
    />
  );
}
