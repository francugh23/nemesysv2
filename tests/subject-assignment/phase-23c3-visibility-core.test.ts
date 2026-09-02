import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { matchesMatrixCoverageFilter, projectMatrixCell, summarizeProjectedCells, type MatrixCell } from "../../lib/assignment-matrix-projection";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

const teacher = { id: "teacher-1", name: "Santos" };
const anotherTeacher = { id: "teacher-2", name: "Reyes" };

function term(id: string, options: Partial<MatrixCell["termAssignments"][number]> = {}) {
  return {
    academicTermId: id,
    assignmentId: null,
    teacher: null,
    initialAssignmentAllowed: true,
    ownershipEditable: true,
    protectedOwnership: false,
    termHasStarted: false,
    ...options,
  };
}

test("Phase 23-C3.1 projects all and exact-Term matrix states without persistence", () => {
  const cell = { termAssignments: [term("term-1", { assignmentId: "assignment-1", teacher, initialAssignmentAllowed: false }), term("term-2", { assignmentId: "assignment-2", teacher, initialAssignmentAllowed: false }), term("term-3")] };
  const allTerms = projectMatrixCell(cell, null);
  const termOne = projectMatrixCell(cell, "term-1");
  const termThree = projectMatrixCell(cell, "term-3");

  assert.equal(allTerms.state, "MIXED_BY_TERM");
  assert.equal(termOne.state, "SINGLE_TEACHER");
  assert.equal(termOne.termAssignments[0]?.teacher?.name, "Santos");
  assert.equal(termThree.state, "UNASSIGNED");
  assert.equal(termThree.termAssignments.length, 1);
});

test("Phase 23-C3.1 derives coverage without NaN, fake percentages, or subject counts", () => {
  const full = projectMatrixCell({ termAssignments: [term("term-1", { assignmentId: "assignment-1", teacher, initialAssignmentAllowed: false })] }, null);
  const partial = projectMatrixCell({ termAssignments: [term("term-1", { assignmentId: "assignment-2", teacher, initialAssignmentAllowed: false }), term("term-2")] }, null);
  const empty = summarizeProjectedCells([]);
  const summary = summarizeProjectedCells([full, partial]);

  assert.deepEqual(empty, { expectedScopes: 0, assignedScopes: 0, missingScopes: 0, coveragePercent: null, completeCells: 0, partiallyCoveredCells: 0, mixedCells: 0, protectedScopes: 0, startedUnassignedScopes: 0 });
  assert.equal(summary.expectedScopes, 3);
  assert.equal(summary.assignedScopes, 2);
  assert.equal(summary.missingScopes, 1);
  assert.equal(summary.coveragePercent, 2 / 3 * 100);
  assert.equal(summary.completeCells, 1);
  assert.equal(summary.partiallyCoveredCells, 1);
  assert.equal(summary.mixedCells, 1);
});

test("Phase 23-C3.1 projects protected and started-unassigned scopes distinctly", () => {
  const protectedCell = projectMatrixCell({ termAssignments: [term("term-1", { assignmentId: "assignment-1", teacher, initialAssignmentAllowed: false, ownershipEditable: false, protectedOwnership: true, termHasStarted: true }), term("term-2", { termHasStarted: true })] }, null);

  assert.equal(protectedCell.protectedScopeCount, 1);
  assert.equal(protectedCell.startedUnassignedScopeCount, 1);
  assert.equal(protectedCell.actionableScopeCount, 1);
});

test("Phase 23-C3.1 coverage filters use displayed cell scopes", () => {
  const partial = projectMatrixCell({ termAssignments: [term("term-1", { assignmentId: "assignment-1", teacher, initialAssignmentAllowed: false }), term("term-2"), term("term-3", { assignmentId: "assignment-2", teacher: anotherTeacher, initialAssignmentAllowed: false })] }, null);
  const exactAssigned = projectMatrixCell({ termAssignments: partial.termAssignments }, "term-1");
  const protectedCell = projectMatrixCell({ termAssignments: [term("term-1", { assignmentId: "assignment-3", teacher, initialAssignmentAllowed: false, ownershipEditable: false, protectedOwnership: true, termHasStarted: true })] }, null);

  for (const filter of ["ALL", "MISSING", "ASSIGNED", "MIXED_BY_TERM"] as const) assert.equal(matchesMatrixCoverageFilter(partial, filter), true);
  assert.equal(matchesMatrixCoverageFilter(partial, "PROTECTED"), false);
  assert.equal(matchesMatrixCoverageFilter(protectedCell, "PROTECTED"), true);
  assert.equal(matchesMatrixCoverageFilter(exactAssigned, "ASSIGNED"), true);
  assert.equal(matchesMatrixCoverageFilter(exactAssigned, "MIXED_BY_TERM"), false);
});

test("Phase 23-C3.1 retains canonical matrix reads and adds client-only term/filter selection safety", async () => {
  const [matrix, page, hooks, service] = await Promise.all([
    read("app/(protected)/dashboard/assignments/components/assignment-matrix.tsx"),
    read("app/(protected)/dashboard/assignments/page.tsx"),
    read("hooks/subject-assignment.hook.ts"),
    read("services/subject-assignment.service.ts"),
  ]);

  assert.match(page, /Term focus/);
  assert.match(page, /All Terms/);
  assert.match(page, /setTermId\(null\)/);
  assert.match(matrix, /projectMatrixCell/);
  assert.match(matrix, /summarizeProjectedCells/);
  assert.match(matrix, /Coverage filter/);
  assert.match(matrix, /MIXED_BY_TERM/);
  assert.match(matrix, /Select all visible/);
  assert.match(matrix, /Clear selection/);
  assert.match(matrix, /actionable assignment scope/);
  assert.match(matrix, /aria-live="polite"/);
  assert.match(matrix, /because the \$\{reason\} changed/);
  assert.match(matrix, /Copy source:/);
  assert.match(matrix, /Initial assignment allowed/);
  assert.match(matrix, /Protected/);
  assert.match(matrix, /<Badge/);
  assert.match(matrix, /LockKeyhole/);
  assert.match(matrix, /overflow-x-auto/);
  assert.match(matrix, /max-h-\[90dvh\][\s\S]*flex-col overflow-hidden/);
  assert.match(matrix, /ScrollArea className="min-h-0 flex-1/);
  assert.doesNotMatch(matrix, /<select/);
  assert.match(service, /termHasStarted/);
  assert.match(hooks, /queryKey: \["assignment-matrix", query\]/);
  assert.doesNotMatch(hooks, /termId/);
});
