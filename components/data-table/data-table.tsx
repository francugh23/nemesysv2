"use client";

import { cn } from "@/lib/utils";
import { type MutableRefObject, type ReactNode, useEffect, useState } from "react";
import {
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  ColumnFiltersState,
  getFilteredRowModel,
  Table as TanstackTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DataTablePagination } from "./data-table-pagination";

export interface DataTableServerOptions {
  pagination: PaginationState;
  sorting: SortingState;
  pageCount: number;
  totalCount: number;
  onPaginationChange: OnChangeFn<PaginationState>;
  onSortingChange: OnChangeFn<SortingState>;
  pageSizeOptions?: number[];
  disabled?: boolean;
}

export interface DataTableStateOptions {
  isLoading?: boolean;
  isError?: boolean;
  isFetching?: boolean;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  toolbar?: (table: TanstackTable<TData>) => ReactNode;
  tableRef?: MutableRefObject<TanstackTable<TData> | null>;
  server?: DataTableServerOptions;
  state?: DataTableStateOptions;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  toolbar,
  tableRef,
  server,
  state,
}: DataTableProps<TData, TValue>) {
  const [clientPagination, setClientPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [clientSorting, setClientSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const pagination = server?.pagination ?? clientPagination;
  const sorting = server?.sorting ?? clientSorting;

  // TanStack Table exposes mutable APIs and is intentionally not compiler-memoized.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,

    state: {
      pagination,
      sorting,
      columnFilters,
    },

    onPaginationChange: server?.onPaginationChange ?? setClientPagination,
    onSortingChange: server?.onSortingChange ?? setClientSorting,
    onColumnFiltersChange: setColumnFilters,
    manualPagination: Boolean(server),
    manualSorting: Boolean(server),
    pageCount: server?.pageCount,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  useEffect(() => {
    if (!tableRef) return;

    tableRef.current = table;

    return () => {
      if (tableRef.current === table) {
        tableRef.current = null;
      }
    };
  }, [table, tableRef]);

  const totalRows = server?.totalCount ?? table.getFilteredRowModel().rows.length;

  if (state?.isLoading) {
    return state.loadingFallback ?? (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        Loading records...
      </div>
    );
  }

  if (state?.isError) {
    return state.errorFallback ?? (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        Unable to load records.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toolbar?.(table)}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(
                    "transition-colors hover:bg-muted/50",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={(event) => {
                    const target = event.target as HTMLElement;

                    if (
                      target.closest("button") ||
                      target.closest("[role='menuitem']") ||
                      target.closest("[role='menu']")
                    ) {
                      return;
                    }

                    onRowClick?.(row.original);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-40 text-center"
                >
                  <div className="space-y-2">
                    <p className="font-medium">
                      {state?.emptyTitle ?? "No records found"}
                    </p>

                    <p className="text-sm text-muted-foreground">
                      {state?.emptyDescription ??
                        "Try adjusting your search or filters."}
                    </p>
                    {state?.emptyAction}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DataTablePagination
          table={table}
          totalCount={totalRows}
          pageSizeOptions={server?.pageSizeOptions}
          disabled={server?.disabled}
        />
      </div>
    </div>
  );
}
