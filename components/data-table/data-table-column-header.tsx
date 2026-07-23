"use client";

import { Column } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className="px-2 font-medium">{title}</div>;
  }

  return (
    <Button
      variant="ghost"
      className="-ml-3 h-8 px-2"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      <span>{title}</span>

      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );
}