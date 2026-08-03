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
  disabled,
  className,
}: DataTableFacetedFilterProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  function selectValue(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        aria-label={
          selectedOption ? `${label}: ${selectedOption.label}` : label
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
        {selectedOption ? (
          <Badge
            variant="secondary"
            className="max-w-40 border-0 bg-muted px-1.5 font-normal"
          >
            <span className="truncate">{selectedOption.label}</span>
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
              data-checked={!value}
              onSelect={() => selectValue("")}
            >
              {allLabel}
              {!value && <span className="sr-only">Current selection</span>}
            </CommandItem>
            <CommandSeparator />
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={`${option.label} ${option.value}`}
                data-checked={value === option.value}
                onSelect={() => selectValue(option.value)}
              >
                <span className="truncate">{option.label}</span>
                {value === option.value && (
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
