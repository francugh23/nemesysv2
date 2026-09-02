import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  SubjectAssignmentHistoryOptionsQuerySchema,
  SubjectAssignmentHistoryQuerySchema,
} from "../../schemas";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

test("Phase 23-C3.4B validates bounded historical option and History filters", () => {
  assert.deepEqual(
    SubjectAssignmentHistoryQuerySchema.parse({
      teacherId: "cm4j5urty0000b2rc60skab12",
      sectionId: "cm4j5urty0001b2rc60skab12",
      subjectOfferingId: "cm4j5urty0002b2rc60skab12",
    }),
    {
      teacherId: "cm4j5urty0000b2rc60skab12",
      sectionId: "cm4j5urty0001b2rc60skab12",
      subjectOfferingId: "cm4j5urty0002b2rc60skab12",
      page: 1,
      pageSize: 25,
    },
  );
  assert.deepEqual(
    SubjectAssignmentHistoryOptionsQuerySchema.parse({
      kind: "TEACHER",
      q: "  Santos Juan  ",
      selectedId: "cm4j5urty0000b2rc60skab12",
    }),
    {
      kind: "TEACHER",
      q: "Santos Juan",
      selectedId: "cm4j5urty0000b2rc60skab12",
    },
  );
  assert.equal(
    SubjectAssignmentHistoryOptionsQuerySchema.safeParse({ kind: "TEACHER", q: "x".repeat(101) }).success,
    false,
  );
});

test("Phase 23-C3.4B uses represented historical entities with bounded searchable options", async () => {
  const repository = await read("repositories/subject-assignment.repository.ts");
  const options = repository.match(/export function findSubjectAssignmentHistoryOptions[\s\S]*?(?=export function findAcademicYearForAssignment)/)?.[0] ?? "";

  assert.match(options, /prisma\.teacher\.findMany/);
  assert.match(options, /prisma\.section\.findMany/);
  assert.match(options, /prisma\.subjectOffering\.findMany/);
  assert.match(options, /subjectAssignments: \{ some: \{\} \}/);
  assert.match(options, /terms: \{ some: \{ subjectAssignments: \{ some: \{\} \} \} \}/);
  assert.equal((options.match(/take: 25/g) ?? []).length, 3);
  for (const field of ["employeeNumber", "firstName", "middleName", "lastName", "sectionName", "subjectCode", "subjectDescription"]) {
    assert.match(options, new RegExp(field));
  }
  assert.doesNotMatch(options, /deletedAt: null/);
  assert.doesNotMatch(options, /status: "ACTIVE"/);
  assert.match(options, /query\.selectedId \? \[\{ id: query\.selectedId \}\] : \[\]/);
  assert.match(options, /orderBy:/);
});

test("Phase 23-C3.4B keeps selected IDs represented and returns readable labels", async () => {
  const [repository, service] = await Promise.all([
    read("repositories/subject-assignment.repository.ts"),
    read("services/subject-assignment.service.ts"),
  ]);
  const options = repository.match(/export function findSubjectAssignmentHistoryOptions[\s\S]*?(?=export function findAcademicYearForAssignment)/)?.[0] ?? "";

  assert.match(options, /subjectAssignments: \{ some: \{\} \}[\s\S]*?id: query\.selectedId/);
  assert.match(options, /terms: \{ some: \{ subjectAssignments: \{ some: \{\} \} \} \}[\s\S]*?id: query\.selectedId/);
  assert.match(service, /label: `\$\{option\.employeeNumber\} · \$\{name\}`/);
  assert.match(service, /label: `Grade \$\{option\.gradeLevel\} \$\{option\.sectionName\}`/);
  assert.match(service, /label: `\$\{option\.subjectCode\} · \$\{option\.subjectDescription\}`/);
  assert.doesNotMatch(service, /label: option\.id/);
});

test("Phase 23-C3.4B applies the three History predicates before pagination", async () => {
  const repository = await read("repositories/subject-assignment.repository.ts");
  const history = repository.match(/function getSubjectAssignmentHistoryWhere[\s\S]*?(?=const subjectAssignmentHistorySelect)/)?.[0] ?? "";

  for (const field of ["teacherId: filters.teacherId", "sectionId: filters.sectionId", "subjectOfferingId: filters.subjectOfferingId"]) {
    assert.match(history, new RegExp(field));
  }
  assert.match(repository, /where: getSubjectAssignmentHistoryWhere\(filters\)[\s\S]*?skip: pagination\.skip[\s\S]*?take: pagination\.take/);
});

test("Phase 23-C3.4B keeps URL filters, cache separation, and async selector accessibility", async () => {
  const [page, hooks, selector] = await Promise.all([
    read("app/(protected)/dashboard/assignments/page.tsx"),
    read("hooks/subject-assignment.hook.ts"),
    read("components/ui/searchable-select.tsx"),
  ]);

  assert.match(page, /historyFilterKeys = \["status", "academicYearId", "academicTermId", "teacherId", "sectionId", "subjectOfferingId"\]/);
  assert.match(page, /useSubjectAssignmentHistoryOptions\(/);
  assert.match(page, /selectedId: historyQuery\.teacherId/);
  assert.match(page, /selectedId: historyQuery\.sectionId/);
  assert.match(page, /selectedId: historyQuery\.subjectOfferingId/);
  assert.match(page, /setFilter\("teacherId", value\)/);
  assert.match(page, /setFilter\("sectionId", value\)/);
  assert.match(page, /setFilter\("subjectOfferingId", value\)/);
  assert.match(page, /Search Teachers\.\.\./);
  assert.match(page, /Search Sections\.\.\./);
  assert.match(page, /Search Offerings\.\.\./);
  assert.match(page, /No matching Teachers/);
  assert.match(page, /No matching Sections/);
  assert.match(page, /No matching Offerings/);
  assert.match(hooks, /queryKey: \["subject-assignments", "history-options", query\]/);
  assert.doesNotMatch(hooks.match(/export function useSubjectAssignmentHistoryOptions[\s\S]*?(?=export function|$)/)?.[0] ?? "", /subject-assignment-options/);
  assert.match(selector, /inputValue\?: string/);
  assert.match(selector, /onInputValueChange\?: \(value: string\) => void/);
  assert.match(selector, /isLoading\?: boolean/);
  assert.match(selector, /onInputValueChange=\{onInputValueChange\}/);
  assert.match(selector, /ComboboxEmpty>\{isLoading \? loadingLabel : emptyLabel\}/);
});
