import assert from "node:assert/strict";
import test from "node:test";

import {
  invalidateImportQueries,
  invalidateSectionQueries,
  invalidateStudentQueries,
  invalidateSubjectQueries,
  invalidateTeacherQueries,
} from "../../hooks/query-invalidation";

function createInvalidationRecorder() {
  const queryKeys: unknown[][] = [];

  return {
    queryKeys,
    queryClient: {
      invalidateQueries: async ({ queryKey }: { queryKey?: readonly unknown[] }) => {
        queryKeys.push([...(queryKey ?? [])]);
      },
    },
  };
}

test("Teacher mutations refresh only their list and dependent selectors", async () => {
  const { queryClient, queryKeys } = createInvalidationRecorder();

  await invalidateTeacherQueries(queryClient);

  assert.deepEqual(queryKeys, [
    ["teachers"],
    ["subject-assignment-options"],
    ["section-form-options"],
  ]);
});

test("Subject mutations refresh only their list and Assignment selectors", async () => {
  const { queryClient, queryKeys } = createInvalidationRecorder();

  await invalidateSubjectQueries(queryClient);

  assert.deepEqual(queryKeys, [
    ["subjects"],
    ["subject-assignment-options"],
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
  ]);
});

test("Imports can add narrowly scoped dependent query invalidation", async () => {
  const { queryClient, queryKeys } = createInvalidationRecorder();

  await invalidateImportQueries(queryClient, ["subjects"], [
    ["subject-assignment-options"],
  ]);

  assert.deepEqual(queryKeys, [
    ["subjects"],
    ["subject-assignment-options"],
  ]);
});
