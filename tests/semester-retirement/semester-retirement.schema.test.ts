import assert from "node:assert/strict";
import test from "node:test";

import {
  CreateEnrollmentSchema,
  UpdateEnrollmentSchema,
} from "../../schemas/enrollment.schema";
import {
  CreateSubjectSchema,
  UpdateSubjectSchema,
} from "../../schemas/subject.schema";

test("Subject writes ignore legacy Semester input", () => {
  const create = CreateSubjectSchema.parse({
    code: "ENG 7",
    description: "English",
    gradeLevel: "7",
    semester: "FIRST",
  });
  const update = UpdateSubjectSchema.parse({
    code: "ENG 7",
    description: "English",
    gradeLevel: "7",
    semester: "SECOND",
  });

  assert.equal("semester" in create, false);
  assert.equal("semester" in update, false);
});

test("Enrollment writes ignore legacy Semester input", () => {
  const create = CreateEnrollmentSchema.parse({
    studentId: "student",
    sectionId: "section",
    academicYearId: "academic-year",
    entryAcademicTermId: "academic-term",
    semester: "FIRST",
  });
  const update = UpdateEnrollmentSchema.parse({
    sectionId: "section",
    status: "ACTIVE",
    semester: "SECOND",
  });

  assert.equal("semester" in create, false);
  assert.equal("semester" in update, false);
});
