import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { SubjectAssignmentHistoryQuerySchema } from "../../schemas";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

test("Phase 23-C3.4A validates bounded History pagination and filters", () => {
  assert.deepEqual(
    SubjectAssignmentHistoryQuerySchema.parse({}),
    { page: 1, pageSize: 25 },
  );
  assert.deepEqual(
    SubjectAssignmentHistoryQuerySchema.parse({
      q: "  Santos  ",
      status: "ARCHIVED",
      page: "2",
      pageSize: "50",
    }),
    { q: "Santos", status: "ARCHIVED", page: 2, pageSize: 50 },
  );
  assert.equal(
    SubjectAssignmentHistoryQuerySchema.safeParse({ pageSize: 10 }).success,
    false,
  );
  assert.equal(
    SubjectAssignmentHistoryQuerySchema.safeParse({ q: "x".repeat(101) }).success,
    false,
  );
});

test("Phase 23-C3.4A reads assignment entities across active and archived lifecycle", async () => {
  const [repository, service] = await Promise.all([
    read("repositories/subject-assignment.repository.ts"),
    read("services/subject-assignment.service.ts"),
  ]);

  const history = repository.match(/function getSubjectAssignmentHistoryWhere[\s\S]*?(?=const subjectAssignmentHistorySelect)/)?.[0] ?? "";
  assert.match(history, /filters\.status === "ACTIVE"[\s\S]*\? null/);
  assert.match(history, /filters\.status === "ARCHIVED"[\s\S]*\? \{ not: null \}/);
  assert.doesNotMatch(history, /teacher:[\s\S]{0,100}deletedAt: null/);
  assert.doesNotMatch(history, /section:[\s\S]{0,100}deletedAt: null/);
  assert.doesNotMatch(history, /subjectOffering:[\s\S]{0,100}deletedAt: null/);
  assert.match(service, /status: assignment\.deletedAt \? "ARCHIVED" as const : "ACTIVE" as const/);
  assert.match(service, /changedAt: assignment\.deletedAt \?\? assignment\.updatedAt/);
});

test("Phase 23-C3.4A uses set-based, deterministic RepeatableRead History pagination", async () => {
  const [repository, service] = await Promise.all([
    read("repositories/subject-assignment.repository.ts"),
    read("services/subject-assignment.service.ts"),
  ]);

  assert.match(repository, /countSubjectAssignmentHistory/);
  assert.match(repository, /findSubjectAssignmentHistory/);
  assert.match(repository, /skip: pagination\.skip/);
  assert.match(repository, /take: pagination\.take/);
  assert.match(repository, /orderBy: \[\{ updatedAt: "desc" \}, \{ id: "asc" \}\]/);
  assert.match(service, /Math\.min\(validated\.page, Math\.max\(1, pageCount\)\)/);
  assert.match(service, /TransactionIsolationLevel\.RepeatableRead/);
  assert.match(service, /countSubjectAssignmentHistory\(validated, transaction\)/);
  assert.match(service, /findSubjectAssignmentHistory\([\s\S]*skip: \(page - 1\) \* validated\.pageSize/);
});

test("Phase 23-C3.4A searches represented names rather than raw assignment IDs", async () => {
  const repository = await read("repositories/subject-assignment.repository.ts");
  const history = repository.match(/function getSubjectAssignmentHistoryWhere[\s\S]*?(?=const subjectAssignmentHistorySelect)/)?.[0] ?? "";

  for (const field of ["employeeNumber", "firstName", "middleName", "lastName", "sectionName", "subjectCode", "subjectDescription", "label"]) {
    assert.match(history, new RegExp(field));
  }
  assert.doesNotMatch(history, /id: \{ contains:/);
});

test("Phase 23-C3.4A keeps History URL-driven, read-only, and bounded", async () => {
  const [page, columns, dialog] = await Promise.all([
    read("app/(protected)/dashboard/assignments/page.tsx"),
    read("app/(protected)/dashboard/assignments/components/subject-assignment-history-columns.tsx"),
    read("app/(protected)/dashboard/assignments/components/subject-assignment-history-view-dialog.tsx"),
  ]);

  assert.match(page, /historyFilterKeys = \["status", "academicYearId", "academicTermId", "teacherId", "sectionId", "subjectOfferingId"\]/);
  assert.match(page, /searchParams\.get\("view"\) === "history"/);
  assert.match(page, /defaultPageSize: 25/);
  assert.match(page, /pageSizeOptions: \[25, 50\]/);
  assert.match(page, /useSubjectAssignmentHistory\(/);
  assert.match(page, /No teaching assignment history found\./);
  assert.match(page, /No assignments match the current filters\./);
  assert.match(page, /No archived teaching assignments found\./);
  assert.doesNotMatch(columns, /teacherId|sectionId|subjectOfferingId|academicTermId/);
  assert.doesNotMatch(columns, /onEdit|onArchive|SubjectAssignmentActions/);
  assert.match(dialog, /max-h-\[92dvh\][\s\S]*min-h-0[\s\S]*overflow-hidden!/);
  assert.match(dialog, /<ScrollArea className="min-h-0 flex-1">/);
  assert.match(dialog, /Archived/);
  assert.match(dialog, /Last updated/);
});

test("Phase 23-C3.4A gives History a dedicated cache family covered by successful assignment mutations", async () => {
  const hooks = await read("hooks/subject-assignment.hook.ts");

  assert.match(hooks, /queryKey: \["subject-assignments", "history", query\]/);
  assert.match(hooks, /queryKey: \["subject-assignments", "history-filter-options", query\]/);
  for (const mutation of ["useMutateAssignmentMatrix", "useUpdateSubjectAssignment", "useArchiveSubjectAssignment"]) {
    const source = hooks.match(new RegExp(`export function ${mutation}[\\s\\S]*?(?=export function|$)`))?.[0] ?? "";
    assert.match(source, /if \(result\.error\)[\s\S]*?return;/);
    assert.match(source, /invalidateQueries\(\{ queryKey: \["subject-assignments"\] \}\)/);
  }
});
