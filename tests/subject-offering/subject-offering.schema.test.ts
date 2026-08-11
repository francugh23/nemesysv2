import assert from "node:assert/strict";
import test from "node:test";
import { CreateSubjectOfferingSchema } from "../../schemas/subject-offering.schema";

test("Subject Offering requires its subject, year, grade, and term selection", () => {
  assert.equal(CreateSubjectOfferingSchema.safeParse({ subjectId: "s", academicYearId: "y", gradeLevel: "7", academicTermIds: ["t1", "t2", "t3"] }).success, true);
  assert.equal(CreateSubjectOfferingSchema.safeParse({ subjectId: "s", academicYearId: "y", gradeLevel: "7", academicTermIds: [] }).success, false);
});

test("Subject Offering restricts SSHS context to Grade 11-12 and validates provenance", () => {
  const base = { subjectId: "s", academicYearId: "y", academicTermIds: ["t"] };
  assert.equal(CreateSubjectOfferingSchema.safeParse({ ...base, gradeLevel: "7", shsContext: { classification: "CORE", curriculumStatus: "PROVISIONAL_DEPED", sourceReference: "DO 017" } }).success, false);
  assert.equal(CreateSubjectOfferingSchema.safeParse({ ...base, gradeLevel: "11" }).success, false);
  assert.equal(CreateSubjectOfferingSchema.safeParse({ ...base, gradeLevel: "11", shsContext: { classification: "CORE", curriculumStatus: "PROVISIONAL_DEPED", sourceReference: "DO 017" } }).success, true);
  assert.equal(CreateSubjectOfferingSchema.safeParse({ ...base, gradeLevel: "11", shsContext: { classification: "ACADEMIC_ELECTIVE", curriculumStatus: "SCHOOL_APPROVED", clusterId: "cluster" } }).success, false);
  assert.equal(CreateSubjectOfferingSchema.safeParse({ ...base, gradeLevel: "12", shsContext: { classification: "TECHPRO_ELECTIVE", curriculumStatus: "SCHOOL_APPROVED", clusterId: "cluster", approvalReference: "Board Resolution 1" } }).success, true);
});
