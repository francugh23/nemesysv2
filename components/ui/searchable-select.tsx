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
  id?: string;
  ariaLabel?: string;
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  id,
  ariaLabel,
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  className,
}: SearchableSelectProps) {
  const optionsByValue = new Map(
    options.map((option) => [option.value, option]),
  );
  const optionValues = options.map((option) => option.value);

  function getOptionLabel(optionValue: string) {
    return optionsByValue.get(optionValue)?.label ?? "";
  }

  function filterOption(optionValue: string, query: string) {
    const option = optionsByValue.get(optionValue);
    const searchText = `${option?.label ?? ""} ${option?.searchValue ?? ""}`;

    return searchText.toLowerCase().includes(query.toLowerCase());
  }

  return (
    <Combobox
      items={optionValues}
      value={value ?? null}
      onValueChange={(optionValue) => onValueChange(optionValue ?? "")}
      itemToStringLabel={getOptionLabel}
      filter={filterOption}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        aria-label={ariaLabel}
        className={className}
        placeholder={placeholder}
        disabled={disabled}
      />
      <ComboboxContent>
        <ComboboxEmpty>No matching options.</ComboboxEmpty>
        <ComboboxList>
          {(option) => (
            <ComboboxItem key={option} value={option}>
              {getOptionLabel(option)}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
