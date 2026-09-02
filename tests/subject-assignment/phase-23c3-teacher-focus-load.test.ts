import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { groupMissingMatrixScopes, matchesMatrixCoverageFilter, matchesMatrixTeacherFocus, matchingTeacherTerms, projectMatrixCell } from "../../lib/assignment-matrix-projection";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");
const santos = { id: "teacher-santos", name: "Santos" };
const reyes = { id: "teacher-reyes", name: "Reyes" };

function term(id: string, options: Partial<Parameters<typeof projectMatrixCell>[0]["termAssignments"][number]> = {}) {
  return { academicTermId: id, assignmentId: null, teacher: null, initialAssignmentAllowed: true, ownershipEditable: true, protectedOwnership: false, termHasStarted: false, ...options };
}

test("Phase 23-C3.2 Teacher focus matches displayed scopes without changing mixed ownership", () => {
  const mixed = projectMatrixCell({ termAssignments: [term("term-1", { assignmentId: "assignment-1", teacher: santos, initialAssignmentAllowed: false }), term("term-2", { assignmentId: "assignment-2", teacher: reyes, initialAssignmentAllowed: false }), term("term-3")] }, null);
  const exact = projectMatrixCell({ termAssignments: mixed.termAssignments }, "term-1");

  assert.equal(mixed.state, "MIXED_BY_TERM");
  assert.equal(matchesMatrixTeacherFocus(mixed, santos.id), true);
  assert.equal(matchesMatrixTeacherFocus(mixed, reyes.id), true);
  assert.equal(matchesMatrixTeacherFocus(mixed, "UNASSIGNED"), true);
  assert.equal(matchesMatrixTeacherFocus(exact, santos.id), true);
  assert.equal(matchesMatrixTeacherFocus(exact, reyes.id), false);
  assert.deepEqual(matchingTeacherTerms(mixed, santos.id).map((item) => item.academicTermId), ["term-1"]);
});

test("Phase 23-C3.2 Teacher and coverage filters use AND semantics", () => {
  const cell = projectMatrixCell({ termAssignments: [term("term-1", { assignmentId: "assignment-1", teacher: santos, initialAssignmentAllowed: false }), term("term-2")] }, null);

  assert.equal(matchesMatrixTeacherFocus(cell, santos.id) && matchesMatrixCoverageFilter(cell, "MISSING"), true);
  assert.equal(matchesMatrixTeacherFocus(cell, reyes.id) && matchesMatrixCoverageFilter(cell, "MISSING"), false);
});

test("Phase 23-C3.2 groups missing assignment scopes by Offering across Sections and Terms", () => {
  const groups = groupMissingMatrixScopes([
    { offeringId: "math", offeringCode: "MATH7", offeringDescription: "Math 7", sectionId: "a", sectionName: "A", academicTermId: "term-1", academicTermName: "Term 1", termHasStarted: true, initialAssignmentAllowed: true },
    { offeringId: "math", offeringCode: "MATH7", offeringDescription: "Math 7", sectionId: "b", sectionName: "B", academicTermId: "term-2", academicTermName: "Term 2", termHasStarted: false, initialAssignmentAllowed: true },
    { offeringId: "science", offeringCode: "SCI7", offeringDescription: "Science 7", sectionId: "a", sectionName: "A", academicTermId: "term-1", academicTermName: "Term 1", termHasStarted: false, initialAssignmentAllowed: true },
  ]);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0], { offeringId: "math", offeringCode: "MATH7", offeringDescription: "Math 7", scopes: [
    { offeringId: "math", offeringCode: "MATH7", offeringDescription: "Math 7", sectionId: "a", sectionName: "A", academicTermId: "term-1", academicTermName: "Term 1", termHasStarted: true, initialAssignmentAllowed: true },
    { offeringId: "math", offeringCode: "MATH7", offeringDescription: "Math 7", sectionId: "b", sectionName: "B", academicTermId: "term-2", academicTermName: "Term 2", termHasStarted: false, initialAssignmentAllowed: true },
  ], sectionNames: ["A", "B"], termNames: ["Term 1", "Term 2"] });
});

test("Phase 23-C3.2 uses active Teacher options, exact Term loads, and no current-Term aggregation", async () => {
  const [repository, service, matrix, options, hooks] = await Promise.all([
    read("repositories/subject-assignment.repository.ts"),
    read("services/subject-assignment.service.ts"),
    read("app/(protected)/dashboard/assignments/components/assignment-matrix.tsx"),
    read("components/ui/searchable-select.tsx"),
    read("hooks/subject-assignment.hook.ts"),
  ]);

  assert.match(repository, /findAssignmentMatrixTeacherLoads\(academicYearId: string/);
  assert.match(service, /termLoads:/);
  assert.match(service, /assignmentScopeCount/);
  assert.match(service, /distinctOfferingCount/);
  assert.match(service, /distinctSectionCount/);
  assert.doesNotMatch(service, /currentTermAssignmentScopeCount/);
  assert.match(matrix, /SearchableSelect/);
  assert.match(matrix, /Teacher focus/);
  assert.match(matrix, /All Teachers/);
  assert.match(matrix, /UNASSIGNED/);
  assert.match(matrix, /employeeNumber.*middleName.*lastName/);
  assert.match(matrix, /termId\s*\?\s*\(termLoad\?\.assignmentScopeCount \?\? 0\)/);
  assert.match(matrix, /Teacher Load \(informational\)/);
  assert.match(matrix, /Missing Coverage/);
  assert.match(matrix, /Initial assignment allowed/);
  assert.match(matrix, /max-h-\[90dvh\][\s\S]*flex-col overflow-hidden/);
  assert.match(matrix, /ScrollArea className="min-h-0 flex-1/);
  assert.match(matrix, /because the \$\{reason\} changed/);
  assert.match(options, /ariaLabel/);
  assert.match(hooks, /queryKey: \["assignment-matrix", query\]/);
  assert.doesNotMatch(hooks, /teacherFocus/);
});
