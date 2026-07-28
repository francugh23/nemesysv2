"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

export interface SearchableSelectOption {
  value: string;
  label: string;
  searchValue?: string;
}

interface SearchableSelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  className,
}: SearchableSelectProps) {
  const selectedOption = options.find((option) => option.value === value) ?? null;

  return (
    <Combobox
      items={options}
      value={selectedOption}
      onValueChange={(option) => onValueChange(option?.value ?? "")}
      itemToStringValue={(option) =>
        `${option.label} ${option.searchValue ?? ""}`
      }
      disabled={disabled}
    >
      <ComboboxInput
        className={className}
        placeholder={placeholder}
        disabled={disabled}
      />
      <ComboboxContent>
        <ComboboxEmpty>No matching options.</ComboboxEmpty>
        <ComboboxList>
          {(option) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
