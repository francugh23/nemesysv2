"use client";

import type { PaginationState, Table } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  getFirstPagePagination,
  getNextPagePagination,
  getPaginationButtonState,
  getPaginationRange,
  getPreviousPagePagination,
} from "./data-table-pagination.logic";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  totalCount: number;
  pagination?: PaginationState;
  pageCount?: number;
  pageSizeOptions?: number[];
  disabled?: boolean;
}

export function DataTablePagination<TData>({
  table,
  totalCount,
  pagination: resolvedPagination,
  pageCount: resolvedPageCount,
  pageSizeOptions = [10, 20, 50],
  disabled = false,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } =
    resolvedPagination ?? table.getState().pagination;
  const pageCount = resolvedPageCount ?? table.getPageCount();
  const renderedRowCount = table.getRowModel().rows.length;
  const { firstRecord, lastRecord } = getPaginationRange({
    pageIndex,
    pageSize,
    renderedRowCount,
    totalCount,
  });
  const { canGoPrevious, canGoNext } = getPaginationButtonState({
    pageCount,
    pageIndex,
  });

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium">{firstRecord}</span> to{" "}
        <span className="font-medium">{lastRecord}</span> of{" "}
        <span className="font-medium">{totalCount}</span> records
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={String(pageSize)}
          onValueChange={(value) =>
            table.setPagination(getFirstPagePagination(Number(value)))
          }
          disabled={disabled}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} rows
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <p className="text-sm text-muted-foreground">
          Page {totalCount === 0 ? 0 : pageIndex + 1} of {pageCount}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              table.setPagination(
                getPreviousPagePagination({ pageIndex, pageSize }),
              )
            }
            disabled={disabled || !canGoPrevious}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              table.setPagination(
                getNextPagePagination({ pageIndex, pageSize, pageCount }),
              )
            }
            disabled={disabled || !canGoNext}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
