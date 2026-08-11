import type { PaginationState } from "@tanstack/react-table";

export function resolveServerPagination({
  requestedPagination,
  resolvedPage,
  isPlaceholderData,
}: {
  requestedPagination: PaginationState;
  resolvedPage?: { page: number; pageSize: number };
  isPlaceholderData: boolean;
}) {
  // Placeholder rows belong to the previous query. Keep the URL-requested page
  // authoritative until the fresh response can replace it with a clamped page.
  const pagination = !isPlaceholderData && resolvedPage
    ? {
        pageIndex: resolvedPage.page - 1,
        pageSize: resolvedPage.pageSize,
      }
    : requestedPagination;

  return {
    pagination,
    shouldReconcile:
      Boolean(resolvedPage) &&
      !isPlaceholderData &&
      pagination.pageIndex !== requestedPagination.pageIndex,
  };
}

export function getPaginationRange({
  pageIndex,
  pageSize,
  renderedRowCount,
  totalCount,
}: {
  pageIndex: number;
  pageSize: number;
  renderedRowCount: number;
  totalCount: number;
}) {
  if (totalCount === 0 || renderedRowCount === 0) {
    return { firstRecord: 0, lastRecord: 0 };
  }

  const firstRecord = Math.min(pageIndex * pageSize + 1, totalCount);

  return {
    firstRecord,
    lastRecord: Math.min(firstRecord + renderedRowCount - 1, totalCount),
  };
}

export function getPaginationButtonState({
  pageCount,
  pageIndex,
}: {
  pageCount: number;
  pageIndex: number;
}) {
  return {
    canGoPrevious: pageIndex > 0,
    canGoNext: pageCount > 1 && pageIndex < pageCount - 1,
  };
}

export function getFirstPagePagination(pageSize: number) {
  return { pageIndex: 0, pageSize };
}

export function getPreviousPagePagination({
  pageIndex,
  pageSize,
}: PaginationState) {
  return { pageIndex: Math.max(pageIndex - 1, 0), pageSize };
}

export function getNextPagePagination({
  pageIndex,
  pageSize,
  pageCount,
}: PaginationState & { pageCount: number }) {
  return {
    pageIndex: Math.min(pageIndex + 1, Math.max(pageCount - 1, 0)),
    pageSize,
  };
}
