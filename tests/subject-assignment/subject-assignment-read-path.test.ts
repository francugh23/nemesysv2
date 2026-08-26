import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { findActiveSectionsForAssignment } from "../../repositories/section.repository";
import {
  findActiveTeachersForAssignment,
} from "../../repositories/teacher.repository";
import {
  findActiveAcademicYearsForAssignment,
  findAllSubjectAssignments,
  findAssignmentScopes,
} from "../../repositories/subject-assignment.repository";

test("Subject Assignment reads expose active Offering-Term scopes without assignments", async () => {
  const [assignments, teachers, sections, academicYears, scopes] =
    await Promise.all([
      findAllSubjectAssignments(),
      findActiveTeachersForAssignment(),
      findActiveSectionsForAssignment(),
      findActiveAcademicYearsForAssignment(),
      findAssignmentScopes(),
    ]);

  assert.equal(assignments.length, 0, "baseline setup must not create Assignments");
  assert.equal(teachers.length, 0, "verified baseline has no Teachers");
  assert.equal(sections.length, 6, "expected the six organizational Sections");
  assert.equal(academicYears.length, 1, "expected the ACTIVE Academic Year");
  assert.equal(scopes.length, 125, "expected exact Curriculum Offering-Term scopes");
  assert.ok(scopes.every((scope) => scope.subjectOffering.academicYearId === academicYears[0]?.id));
});
