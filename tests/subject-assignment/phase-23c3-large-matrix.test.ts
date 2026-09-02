import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  getSectionWindowRange,
  getVisibleSectionIds,
  projectMatrixCell,
  summarizeProjectedCells,
} from "../../lib/assignment-matrix-projection";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

function sectionIds(count: number) {
  return Array.from({ length: count }, (_, index) => `section-${index + 1}`);
}

function term(index: number, section: number) {
  const assigned = (index + section) % 3 !== 0;
  return {
    academicTermId: `term-${index}`,
    assignmentId: assigned ? `assignment-${index}-${section}` : null,
    teacher: assigned ? { id: `teacher-${index % 2}`, name: "Santos" } : null,
    initialAssignmentAllowed: !assigned,
    ownershipEditable: assigned && index !== 1,
    protectedOwnership: assigned && index === 1,
    termHasStarted: index !== 3,
  };
}

function largeMatrixCells(sectionCount: number) {
  return Array.from({ length: 8 }, (_, offeringIndex) =>
    Array.from({ length: sectionCount }, (_, sectionIndex) =>
      projectMatrixCell(
        {
          termAssignments: [
            term(1, offeringIndex + sectionIndex),
            term(2, offeringIndex + sectionIndex),
            term(3, offeringIndex + sectionIndex),
          ],
        },
        null,
      ),
    ),
  ).flat();
}

test("Phase 23-C3.3 keeps normal Sections visible through twelve and windows larger matrices", () => {
  for (const count of [1, 4, 10, 12]) {
    const ids = sectionIds(count);
    assert.deepEqual(
      getVisibleSectionIds({ sectionIds: ids, sectionFocus: "ALL", windowStart: 0, narrow: false }),
      ids,
    );
    assert.equal(getSectionWindowRange(count, 0).hasWindowing, false);
  }

  const twenty = sectionIds(20);
  assert.deepEqual(
    getVisibleSectionIds({ sectionIds: twenty, sectionFocus: "ALL", windowStart: 0, narrow: false }),
    twenty.slice(0, 12),
  );
  assert.deepEqual(getSectionWindowRange(20, 12), { start: 12, end: 20, hasWindowing: true });

  assert.deepEqual(getSectionWindowRange(30, 12), { start: 12, end: 24, hasWindowing: true });
  assert.deepEqual(getSectionWindowRange(30, 24), { start: 24, end: 30, hasWindowing: true });
});

test("Phase 23-C3.3 Section focus and narrow mode render exactly one human-selected Section", () => {
  const ids = sectionIds(20);
  assert.deepEqual(
    getVisibleSectionIds({ sectionIds: ids, sectionFocus: "section-14", windowStart: 0, narrow: false }),
    ["section-14"],
  );
  assert.deepEqual(
    getVisibleSectionIds({ sectionIds: ids, sectionFocus: "ALL", windowStart: 12, narrow: true }),
    ["section-1"],
  );
});

test("Phase 23-C3.3 global coverage is invariant across visible Section windows", () => {
  const twentyCells = largeMatrixCells(20);
  const thirtyCells = largeMatrixCells(30);
  const twentySummary = summarizeProjectedCells(twentyCells);
  const thirtySummary = summarizeProjectedCells(thirtyCells);

  assert.equal(twentySummary.expectedScopes, 8 * 20 * 3);
  assert.equal(thirtySummary.expectedScopes, 8 * 30 * 3);
  assert.ok(twentySummary.missingScopes > 0);
  assert.ok(twentySummary.assignedScopes > 0);
  assert.ok(twentySummary.protectedScopes > 0);
  assert.ok(twentySummary.startedUnassignedScopes > 0);
  assert.ok(twentyCells.some((cell) => cell.state === "MIXED_BY_TERM"));
});

test("Phase 23-C3.3 uses client-only Section context, one matrix scroll owner, and strict reset safety", async () => {
  const [matrix, hooks, table, mobile] = await Promise.all([
    read("app/(protected)/dashboard/assignments/components/assignment-matrix.tsx"),
    read("hooks/subject-assignment.hook.ts"),
    read("components/ui/table.tsx"),
    read("hooks/use-mobile.ts"),
  ]);

  assert.match(matrix, /SearchableSelect[\s\S]*Section focus/);
  assert.match(matrix, /MATRIX_SECTION_WINDOW_SIZE/);
  assert.match(matrix, /Sections \{sectionWindow\.start \+ 1\}-\{sectionWindow\.end\} of/);
  assert.match(matrix, /Previous Sections/);
  assert.match(matrix, /Next Sections/);
  assert.match(matrix, /useIsMobile/);
  assert.match(matrix, /sectionWindowStart/);
  assert.match(matrix, /responsive matrix mode/);
  assert.match(matrix, /setSelectedCells\(\{\}\)[\s\S]*setCopySource\(null\)[\s\S]*setDetail\(null\)/);
  assert.match(matrix, /copySourceLabel/);
  assert.match(matrix, /sticky left-0 z-20[\s\S]*border-r bg-background[\s\S]*shadow/);
  assert.doesNotMatch(matrix, /overflow-x-auto/);
  assert.doesNotMatch(matrix, /sticky top-/);
  assert.match(table, /data-slot="table-container"[\s\S]*overflow-x-auto/);
  assert.match(mobile, /MOBILE_BREAKPOINT = 1024/);
  assert.match(hooks, /queryKey: \["assignment-matrix", query\]/);
  assert.doesNotMatch(hooks, /sectionFocus|sectionWindowStart/);
});
