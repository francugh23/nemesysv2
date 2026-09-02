import assert from "node:assert/strict";
import test from "node:test";
import type {
  InvalidateQueryFilters,
  QueryClient,
  QueryKey,
} from "@tanstack/react-query";

import {
  invalidateImportQueries,
  invalidateSectionQueries,
  invalidateStudentQueries,
  invalidateSubjectQueries,
  invalidateTeacherQueries,
  invalidateAcademicYearQueries,
  invalidateAcademicTermQueries,
  invalidateOperationalDashboard,
} from "../../hooks/query-invalidation";

function createInvalidationRecorder() {
  const queryKeys: unknown[][] = [];
  const queryClient: Pick<QueryClient, "invalidateQueries"> = {
    invalidateQueries: async <TTaggedQueryKey extends QueryKey = QueryKey>(
      filters?: InvalidateQueryFilters<TTaggedQueryKey>,
    ) => {
      queryKeys.push([...(filters?.queryKey ?? [])]);
    },
  };

  return {
    queryKeys,
    queryClient,
  };
}

test("Teacher mutations refresh only their list and dependent selectors", async () => {
  const { queryClient, queryKeys } = createInvalidationRecorder();

  await invalidateTeacherQueries(queryClient);

  assert.deepEqual(queryKeys, [
    ["teachers"],
    ["subject-assignment-options"],
    ["section-form-options"],
    ["assignment-matrix"],
  ]);
});

test("Subject mutations refresh only their list and Assignment selectors", async () => {
  const { queryClient, queryKeys } = createInvalidationRecorder();

  await invalidateSubjectQueries(queryClient);

  assert.deepEqual(queryKeys, [
    ["subjects"],
    ["subject-offering-options"],
    ["subject-assignment-options"],
    ["assignment-matrix"],
  ]);
});

test("Student mutations refresh only their list and Enrollment selectors", async () => {
  const { queryClient, queryKeys } = createInvalidationRecorder();

  await invalidateStudentQueries(queryClient);

  assert.deepEqual(queryKeys, [
    ["students"],
    ["enrollment-form-options"],
  ]);
});

test("Section invalidation retains every existing dependent selector", async () => {
  const { queryClient, queryKeys } = createInvalidationRecorder();

  await invalidateSectionQueries(queryClient);

  assert.deepEqual(queryKeys, [
    ["sections"],
    ["section-form-options"],
    ["subject-assignment-options"],
    ["enrollment-form-options"],
    ["assignment-matrix"],
  ]);
});

test("Imports can add narrowly scoped dependent query invalidation", async () => {
  const { queryClient, queryKeys } = createInvalidationRecorder();

  await invalidateImportQueries(queryClient, ["subjects"], [
    ["subject-offering-options"],
    ["subject-assignment-options"],
  ]);

  assert.deepEqual(queryKeys, [
    ["subjects"],
    ["subject-offering-options"],
    ["subject-assignment-options"],
  ]);
});

test("Teacher import invalidates only Teacher selectors and the operational dashboard", async () => {
  const { queryClient, queryKeys } = createInvalidationRecorder();

  await invalidateImportQueries(queryClient, ["teachers"], [
    ["subject-assignment-options"],
    ["section-form-options"],
    ["dashboard", "operational"],
  ]);

  assert.deepEqual(queryKeys, [
    ["teachers"],
    ["subject-assignment-options"],
    ["section-form-options"],
    ["dashboard", "operational"],
  ]);
});

test("Academic Year mutations refresh management details and operational selectors", async () => {
  const invalidated: unknown[] = [];

  await invalidateAcademicYearQueries({
    invalidateQueries: ((filters: { queryKey?: readonly unknown[] }) => {
      invalidated.push(filters.queryKey);
      return Promise.resolve();
    }) as never,
  });

  assert.deepEqual(invalidated, [
    ["academic-years"],
    ["academic-year-configuration"],
    ["subject-assignment-options"],
    ["enrollment-form-options"],
    ["subject-offering-options"],
    ["shs-current-term-progression"],
    ["assignment-matrix"],
  ]);
});

test("Academic Term mutations refresh their parent management view and term query", async () => {
  const { queryClient, queryKeys } = createInvalidationRecorder();

  await invalidateAcademicTermQueries(queryClient, "academic-year-2026-2027");

  assert.deepEqual(queryKeys, [
    ["academic-years"],
    ["academic-year-configuration", "academic-year-2026-2027"],
    ["academic-terms", "academic-year-2026-2027"],
    ["subject-offering-options"],
    ["dashboard", "operational"],
    ["assignment-matrix"],
  ]);
});

test("Operational dashboard invalidation uses one stable narrow key", async () => {
  const { queryClient, queryKeys } = createInvalidationRecorder();

  await invalidateOperationalDashboard(queryClient);

  assert.deepEqual(queryKeys, [["dashboard", "operational"]]);
});
