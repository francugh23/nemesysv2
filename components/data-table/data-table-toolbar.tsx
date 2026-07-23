"use client";

import { Input } from "@/components/ui/input";

interface DataTableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  children?: React.ReactNode;
}

export function DataTableToolbar({
  search,
  onSearchChange,
  children,
}: DataTableToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <Input
        placeholder="Search..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full md:max-w-sm"
      />

      {children}
    </div>
  );
}