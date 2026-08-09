import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { findActiveSectionsForAssignment } from "../../repositories/section.repository";
import {
  findActiveTeachersForAssignment,
} from "../../repositories/teacher.repository";
import { findSubjects } from "../../repositories/subject.repository";
import {
  findActiveAcademicYearsForAssignment,
  findAllSubjectAssignments,
} from "../../repositories/subject-assignment.repository";

test("Subject Assignment reads preserve migrated records and every form option source", async () => {
  const [assignments, teachers, subjects, sections, academicYears] =
    await Promise.all([
      findAllSubjectAssignments(),
      findActiveTeachersForAssignment(),
      findSubjects(),
      findActiveSectionsForAssignment(),
      findActiveAcademicYearsForAssignment(),
    ]);

  assert.ok(assignments.length > 0, "expected a migrated Subject Assignment");
  assert.ok(teachers.length > 0, "expected eligible Teacher options");
  assert.ok(subjects.length > 0, "expected eligible Subject options");
  assert.ok(sections.length > 0, "expected eligible Section options");
  assert.ok(academicYears.length > 0, "expected an ACTIVE Academic Year");

  const assignment = assignments[0];
  assert.ok(assignment.academicYearId);
  assert.equal(assignment.academicYear.status, "ACTIVE");
  assert.ok(
    academicYears.some((academicYear) => academicYear.id === assignment.academicYearId),
    "expected the migrated Assignment to reference an ACTIVE selector value",
  );
});
