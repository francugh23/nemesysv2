import assert from "node:assert/strict";
import test from "node:test";

import { CorrectSubjectOfferingSchema } from "../../schemas/subject-offering.schema";

const valid = {
  sourceOfferingId: "source-offering",
  effectiveAcademicTermId: "term-3",
  reason: "The configured Subject was incorrect.",
  evidenceReference: "School memorandum 2026-17",
  confirmation: "ENG11",
  replacement: {
    subjectId: "replacement-subject",
    gradeLevel: "11" as const,
    academicTermIds: ["term-3"],
    shsContext: {
      classification: "CORE" as const,
      sourceReference: "Approved school Curriculum guide",
      approvalReference: "Approval 2026-44",
    },
  },
};

test("E2-A correction requires reason, evidence, effective Term, and complete SHS approval facts", () => {
  assert.equal(CorrectSubjectOfferingSchema.safeParse(valid).success, true);
  assert.equal(CorrectSubjectOfferingSchema.safeParse({ ...valid, reason: " " }).success, false);
  assert.equal(CorrectSubjectOfferingSchema.safeParse({ ...valid, evidenceReference: " " }).success, false);
  assert.equal(CorrectSubjectOfferingSchema.safeParse({ ...valid, effectiveAcademicTermId: "" }).success, false);
  assert.equal(CorrectSubjectOfferingSchema.safeParse({ ...valid, replacement: { ...valid.replacement, shsContext: { ...valid.replacement.shsContext, approvalReference: " " } } }).success, false);
});

test("E2-A correction keeps JHS free of SHS context and requires elective clusters", () => {
  const jhs = { ...valid, replacement: { subjectId: "jhs", gradeLevel: "7" as const, academicTermIds: ["term-1", "term-2", "term-3"] } };
  assert.equal(CorrectSubjectOfferingSchema.safeParse(jhs).success, true);
  assert.equal(CorrectSubjectOfferingSchema.safeParse({ ...jhs, replacement: { ...jhs.replacement, shsContext: valid.replacement.shsContext } }).success, false);
  assert.equal(CorrectSubjectOfferingSchema.safeParse({ ...valid, replacement: { ...valid.replacement, shsContext: { ...valid.replacement.shsContext, classification: "ACADEMIC_ELECTIVE" } } }).success, false);
});
