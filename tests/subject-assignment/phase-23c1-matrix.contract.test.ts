import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

test("Phase 23-C1 matrix is active-AY, grade-scoped, and does not require Curriculum finalization", async () => {
  const [repository, service] = await Promise.all([read("repositories/subject-assignment.repository.ts"), read("services/subject-assignment.service.ts")]);
  assert.match(repository, /findActiveAcademicYearsForMatrix/);
  assert.match(repository, /where: \{ status: "ACTIVE" \}/);
  assert.match(repository, /findAssignmentMatrixScopes\(academicYearId: string, gradeLevel: string/);
  assert.match(repository, /gradeLevel === "11"[\s\S]*SCHOOL_APPROVED/);
  assert.doesNotMatch(service.match(/export async function getAssignmentMatrix[\s\S]*?(?=export async function createSubjectAssignmentService)/)?.[0] ?? "", /curriculumFinalization/);
  assert.match(service, /TransactionIsolationLevel\.RepeatableRead/);
});

test("Phase 23-C1 derives exact term cells, coverage, protected state, and informational loads", async () => {
  const service = await read("services/subject-assignment.service.ts");
  for (const state of ["UNASSIGNED", "SINGLE_TEACHER", "MIXED_BY_TERM"]) assert.match(service, new RegExp(`"${state}"`));
  assert.match(service, /expectedScopes: scopes\.length \* sections\.length/);
  assert.match(service, /missingScopes: scopes\.length \* sections\.length - assignedScopes/);
  assert.match(service, /initialAssignmentAllowed: !assignment/);
  assert.match(service, /protectedOwnership/);
  assert.match(service, /activeAssignmentScopeCount/);
  assert.match(service, /distinctOfferingCount/);
  assert.match(service, /distinctSectionCount/);
});

test("Phase 23-C1 keeps a bounded matrix UI and read-only History view", async () => {
  const [page, matrix, columns] = await Promise.all([read("app/(protected)/dashboard/assignments/page.tsx"), read("app/(protected)/dashboard/assignments/components/assignment-matrix.tsx"), read("app/(protected)/dashboard/assignments/components/subject-assignment-columns.tsx")]);
  assert.match(page, /Teaching Matrix/);
  assert.match(page, /History/);
  assert.match(columns, /readOnly = false/);
  assert.match(matrix, /sticky left-0/);
  assert.match(matrix, /overflow-x-auto/);
  assert.match(matrix, /max-h-\[90dvh\][\s\S]*overflow-hidden/);
  assert.match(matrix, /ScrollArea className="min-h-0 flex-1/);
});
