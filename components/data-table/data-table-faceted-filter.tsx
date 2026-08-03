"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DataTableFilterOption {
  label: string;
  value: string;
}

interface DataTableFacetedFilterProps {
  label: string;
  allLabel?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  value: string;
  options: DataTableFilterOption[];
  onValueChange: (value: string) => void;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DataTableFacetedFilter({
  label,
  allLabel = `All ${label}`,
  searchPlaceholder = `Search ${label.toLowerCase()}...`,
  emptyMessage = `No ${label.toLowerCase()} found.`,
  value,
  options,
  onValueChange,
  multiple = false,
  disabled,
  className,
}: DataTableFacetedFilterProps) {
  const [open, setOpen] = useState(false);
  const selectedValues = new Set(value.split(",").filter(Boolean));
  const selectedOptions = options.filter((option) => selectedValues.has(option.value));

  function selectValue(nextValue: string) {
    if (!multiple) {
      onValueChange(nextValue);
      setOpen(false);
      return;
    }

    const nextValues = new Set(selectedValues);

    if (nextValue) {
      if (nextValues.has(nextValue)) {
        nextValues.delete(nextValue);
      } else {
        nextValues.add(nextValue);
      }
    } else {
      nextValues.clear();
    }

    onValueChange([...nextValues].sort().join(","));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={
          selectedOptions.length
            ? `${label}: ${selectedOptions.map((option) => option.label).join(", ")}`
            : label
        }
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 w-full justify-between border-input bg-background px-2.5 font-normal shadow-none sm:w-auto",
              className,
            )}
          />
        }
      >
        {selectedOptions.length ? (
          <Badge
            variant="secondary"
            className="max-w-40 border-0 bg-muted px-1.5 font-normal"
          >
            <span className="truncate">
              {selectedOptions.length === 1
                ? selectedOptions[0].label
                : `${selectedOptions.length} selected`}
            </span>
          </Badge>
        ) : (
          <span className="text-muted-foreground">{label}</span>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0 p-0">
        <Command label={`${label} filter options`}>
          <CommandInput
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
          />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandItem
              value={allLabel}
              data-checked={selectedValues.size === 0}
              onSelect={() => selectValue("")}
            >
              {allLabel}
              {selectedValues.size === 0 && <span className="sr-only">Current selection</span>}
            </CommandItem>
            <CommandSeparator />
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.value}`}
                data-checked={selectedValues.has(option.value)}
                onSelect={() => selectValue(option.value)}
              >
                <span className="truncate">{option.label}</span>
                {selectedValues.has(option.value) && (
                  <span className="sr-only">Current selection</span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
