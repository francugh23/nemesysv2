import assert from "node:assert/strict";
import test from "node:test";

import {
  getFirstPagePagination,
  getNextPagePagination,
  getPaginationButtonState,
  getPaginationRange,
  getPreviousPagePagination,
  resolveServerPagination,
} from "../../components/data-table/data-table-pagination.logic";

test("fresh page one response is authoritative", () => {
  assert.deepEqual(
    resolveServerPagination({
      requestedPagination: { pageIndex: 0, pageSize: 10 },
      resolvedPage: { page: 1, pageSize: 10 },
      isPlaceholderData: false,
    }),
    {
      pagination: { pageIndex: 0, pageSize: 10 },
      shouldReconcile: false,
    },
  );
});

test("Next updates the requested page immediately and fresh page two remains authoritative", () => {
  assert.deepEqual(
    resolveServerPagination({
      requestedPagination: { pageIndex: 1, pageSize: 10 },
      resolvedPage: { page: 2, pageSize: 10 },
      isPlaceholderData: false,
    }),
    {
      pagination: { pageIndex: 1, pageSize: 10 },
      shouldReconcile: false,
    },
  );
});

test("fresh server-clamped final page drives display and URL reconciliation", () => {
  const resolution = resolveServerPagination({
    requestedPagination: { pageIndex: 9, pageSize: 10 },
    resolvedPage: { page: 3, pageSize: 10 },
    isPlaceholderData: false,
  });

  assert.deepEqual(resolution, {
    pagination: { pageIndex: 2, pageSize: 10 },
    shouldReconcile: true,
  });
  assert.deepEqual(
    getPaginationRange({
      ...resolution.pagination,
      renderedRowCount: 7,
      totalCount: 27,
    }),
    { firstRecord: 21, lastRecord: 27 },
  );
  assert.deepEqual(
    getPaginationButtonState({
      pageCount: 3,
      pageIndex: resolution.pagination.pageIndex,
    }),
    { canGoPrevious: true, canGoNext: false },
  );
});

test("a Next request keeps page two state while prior rows are placeholder data", () => {
  assert.deepEqual(
    resolveServerPagination({
      requestedPagination: { pageIndex: 1, pageSize: 50 },
      resolvedPage: { page: 1, pageSize: 10 },
      isPlaceholderData: true,
    }),
    {
      pagination: { pageIndex: 1, pageSize: 50 },
      shouldReconcile: false,
    },
  );
});

test("requested pagination is used before any response is rendered", () => {
  assert.deepEqual(
    resolveServerPagination({
      requestedPagination: { pageIndex: 1, pageSize: 50 },
      isPlaceholderData: false,
    }),
    {
      pagination: { pageIndex: 1, pageSize: 50 },
      shouldReconcile: false,
    },
  );
});

test("fresh data completes a page-size transition on page one", () => {
  assert.deepEqual(
    resolveServerPagination({
      requestedPagination: getFirstPagePagination(50),
      resolvedPage: { page: 1, pageSize: 50 },
      isPlaceholderData: false,
    }),
    {
      pagination: { pageIndex: 0, pageSize: 50 },
      shouldReconcile: false,
    },
  );
});

test("a 50-row page reports all 50 rendered rows", () => {
  assert.deepEqual(
    getPaginationRange({
      pageIndex: 0,
      pageSize: 50,
      renderedRowCount: 50,
      totalCount: 75,
    }),
    { firstRecord: 1, lastRecord: 50 },
  );
});

test("the footer range ends at the actual rendered row count", () => {
  assert.deepEqual(
    getPaginationRange({
      pageIndex: 1,
      pageSize: 50,
      renderedRowCount: 7,
      totalCount: 57,
    }),
    { firstRecord: 51, lastRecord: 57 },
  );
});

test("an empty rendered page has an empty range", () => {
  assert.deepEqual(
    getPaginationRange({
      pageIndex: 2,
      pageSize: 10,
      renderedRowCount: 0,
      totalCount: 20,
    }),
    { firstRecord: 0, lastRecord: 0 },
  );
});

test("Previous is disabled on the first page", () => {
  assert.deepEqual(getPaginationButtonState({ pageCount: 3, pageIndex: 0 }), {
    canGoPrevious: false,
    canGoNext: true,
  });
});

test("Previous returns the requested state to page one", () => {
  assert.deepEqual(
    getPreviousPagePagination({ pageIndex: 1, pageSize: 10 }),
    { pageIndex: 0, pageSize: 10 },
  );
});

test("Next advances the resolved state and stops at the final page", () => {
  assert.deepEqual(
    getNextPagePagination({ pageIndex: 0, pageSize: 10, pageCount: 14 }),
    { pageIndex: 1, pageSize: 10 },
  );
  assert.deepEqual(
    getNextPagePagination({ pageIndex: 13, pageSize: 10, pageCount: 14 }),
    { pageIndex: 13, pageSize: 10 },
  );
});

test("Next is disabled on the last page", () => {
  assert.deepEqual(getPaginationButtonState({ pageCount: 3, pageIndex: 2 }), {
    canGoPrevious: true,
    canGoNext: false,
  });
});

test("both pagination buttons are disabled for one page", () => {
  assert.deepEqual(getPaginationButtonState({ pageCount: 1, pageIndex: 0 }), {
    canGoPrevious: false,
    canGoNext: false,
  });
});

test("changing page size creates page-one state for client and server handlers", () => {
  const nextPagination = getFirstPagePagination(50);

  assert.deepEqual(nextPagination, { pageIndex: 0, pageSize: 50 });
});
