"use client";

import {
  functionalUpdate,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";

interface UseTableUrlStateOptions<TFilterKey extends string> {
  filterKeys: readonly TFilterKey[];
  sortableColumns: readonly string[];
  defaultPageSize?: number;
  pageSizeOptions?: readonly number[];
  pageParam?: string;
  pageSizeParam?: string;
}

export function useTableUrlState<TFilterKey extends string>({
  filterKeys,
  sortableColumns,
  defaultPageSize = 10,
  pageSizeOptions = [10, 20, 50],
  pageParam = "page",
  pageSizeParam = "pageSize",
}: UseTableUrlStateOptions<TFilterKey>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [resetKey, setResetKey] = useState(0);
  const rawSearch = searchParams.get("q") ?? "";
  const urlSearch = rawSearch.trim();

  function replaceParams(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(window.location.search);
    update(params);
    const query = params.toString();

    window.history.replaceState(
      null,
      "",
      query ? `${pathname}?${query}` : pathname,
    );
  }

  function setSearch(value: string) {
    replaceParams((params) => {
      const normalizedSearch = value.trim();

      if (normalizedSearch) {
        params.set("q", normalizedSearch);
      } else {
        params.delete("q");
      }

      params.delete("page");
    });
  }

  const requestedPage = Number(searchParams.get(pageParam));
  const page = Number.isInteger(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  const requestedPageSize = Number(searchParams.get(pageSizeParam));
  const pageSize = pageSizeOptions.includes(requestedPageSize)
    ? requestedPageSize
    : defaultPageSize;
  const sort = searchParams.get("sort");
  const direction = searchParams.get("direction");
  const sorting: SortingState =
    sort && sortableColumns.includes(sort)
      ? [{ id: sort, desc: direction === "desc" }]
      : [];
  const filters = Object.fromEntries(
    filterKeys.map((key) => [key, searchParams.get(key) ?? ""]),
  ) as Record<TFilterKey, string>;
  const normalizeUrl = useEffectEvent(() => {
    replaceParams((params) => {
      if (rawSearch !== urlSearch) {
        if (urlSearch) {
          params.set("q", urlSearch);
        } else {
          params.delete("q");
        }
      }

      if (
        searchParams.has(pageParam) &&
        (!Number.isInteger(requestedPage) || requestedPage <= 1)
      ) {
        params.delete(pageParam);
      }

      if (
        searchParams.has(pageSizeParam) &&
        (!pageSizeOptions.includes(requestedPageSize) ||
          requestedPageSize === defaultPageSize)
      ) {
        params.delete(pageSizeParam);
      }

      if (sort && !sortableColumns.includes(sort)) {
        params.delete("sort");
        params.delete("direction");
      } else if (
        direction &&
        direction !== "asc" &&
        direction !== "desc"
      ) {
        params.delete("direction");
      } else if (direction && !sort) {
        params.delete("direction");
      }
    });
  });
  const needsNormalization =
    rawSearch !== urlSearch ||
    (searchParams.has(pageParam) &&
      (!Number.isInteger(requestedPage) || requestedPage <= 1)) ||
    (searchParams.has(pageSizeParam) &&
      (!pageSizeOptions.includes(requestedPageSize) ||
        requestedPageSize === defaultPageSize)) ||
    Boolean(sort && !sortableColumns.includes(sort)) ||
    Boolean(
      direction &&
        (direction !== "asc" && direction !== "desc" || !sort),
    );

  useEffect(() => {
    if (needsNormalization) {
      normalizeUrl();
    }
  }, [needsNormalization]);

  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = functionalUpdate(updater, {
      pageIndex: page - 1,
      pageSize,
    });

    replaceParams((params) => {
      if (next.pageIndex > 0) {
        params.set(pageParam, String(next.pageIndex + 1));
      } else {
        params.delete(pageParam);
      }

      if (next.pageSize !== defaultPageSize) {
        params.set(pageSizeParam, String(next.pageSize));
      } else {
        params.delete(pageSizeParam);
      }

      if (next.pageSize !== pageSize) {
        params.delete(pageParam);
      }
    });
  };

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = functionalUpdate(updater, sorting)[0];

    replaceParams((params) => {
      if (next && sortableColumns.includes(next.id)) {
        params.set("sort", next.id);
        params.set("direction", next.desc ? "desc" : "asc");
      } else {
        params.delete("sort");
        params.delete("direction");
      }

      params.delete("page");
    });
  };

  function setFilter(key: TFilterKey, value: string) {
    replaceParams((params) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }

      params.delete("page");
    });
  }

  function reset() {
    setResetKey((current) => current + 1);
    replaceParams((params) => {
      [
        "q",
        pageParam,
        pageSizeParam,
        "sort",
        "direction",
        ...filterKeys,
      ].forEach((key) => params.delete(key));
    });
  }

  return {
    query: {
      q: urlSearch || undefined,
      ...filters,
      sort: sorting[0]?.id,
      direction: sorting[0] ? (sorting[0].desc ? "desc" : "asc") : undefined,
      page,
      pageSize,
    },
    search: urlSearch,
    setSearch,
    filters,
    setFilter,
    pagination: {
      pageIndex: page - 1,
      pageSize,
    },
    onPaginationChange,
    sorting,
    onSortingChange,
    reset,
    resetKey,
    hasActiveFilters:
      Boolean(urlSearch) ||
      filterKeys.some((key) => Boolean(filters[key])),
    canReset:
      Boolean(urlSearch) ||
      filterKeys.some((key) => Boolean(filters[key])) ||
      sorting.length > 0 ||
      page > 1 ||
      pageSize !== defaultPageSize,
    pageSizeOptions: [...pageSizeOptions],
  };
}
