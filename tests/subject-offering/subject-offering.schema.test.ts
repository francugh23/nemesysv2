import assert from "node:assert/strict";
import test from "node:test";
import { CreateSubjectOfferingSchema } from "../../schemas/subject-offering.schema";

test("Subject Offering requires its subject, year, grade, and term selection", () => {
  assert.equal(CreateSubjectOfferingSchema.safeParse({ subjectId: "s", academicYearId: "y", gradeLevel: "7", academicTermIds: ["t1", "t2", "t3"] }).success, true);
  assert.equal(CreateSubjectOfferingSchema.safeParse({ subjectId: "s", academicYearId: "y", gradeLevel: "7", academicTermIds: [] }).success, false);
});
