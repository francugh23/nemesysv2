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

test("Subject Assignment reads preserve independent form option sources", async () => {
  const [assignments, teachers, subjects, sections, academicYears] =
    await Promise.all([
      findAllSubjectAssignments(),
      findActiveTeachersForAssignment(),
      findSubjects(),
      findActiveSectionsForAssignment(),
      findActiveAcademicYearsForAssignment(),
    ]);

  assert.equal(assignments.length, 0, "baseline setup must not create Assignments");
  assert.ok(teachers.length > 0, "expected eligible Teacher options");
  assert.equal(subjects.filter((subject) => ["7", "8", "9", "10"].includes(subject.gradeLevel)).length, 32, "expected the JHS baseline Subjects");
  assert.ok(sections.length > 0, "expected eligible Section options");
  assert.ok(academicYears.length > 0, "expected an ACTIVE Academic Year");
});
