import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  getShsCurriculumStatusLabel,
  getShsSubjectClassificationLabel,
} from "../../lib/shs-presentation";

const root = process.cwd();

test("SHS presentation labels preserve persisted enum values while rendering human-readable text", () => {
  assert.equal(getShsSubjectClassificationLabel("CORE"), "Core");
  assert.equal(getShsSubjectClassificationLabel("ACADEMIC_ELECTIVE"), "Academic Elective");
  assert.equal(getShsSubjectClassificationLabel("TECHPRO_ELECTIVE"), "TechPro Elective");
  assert.equal(getShsCurriculumStatusLabel("PROVISIONAL_DEPED"), "Pending School Approval");
  assert.equal(getShsCurriculumStatusLabel("SCHOOL_APPROVED"), "School Approved");
});

test("SHS curriculum and participation surfaces use the centralized labels", () => {
  for (const file of [
    "app/(protected)/dashboard/subject-offerings/components/subject-offering-form.tsx",
    "app/(protected)/dashboard/subject-offerings/components/subject-offering-columns.tsx",
    "app/(protected)/dashboard/subject-offerings/components/curriculum-correction-dialog.tsx",
    "app/(protected)/dashboard/subject-offerings/page.tsx",
    "app/(protected)/dashboard/enrollment/components/student-subject-enrollment-list.tsx",
    "app/(protected)/dashboard/enrollment/components/shs-current-term-subject-selection.tsx",
    "app/(protected)/dashboard/enrollment/components/correct-shs-student-participation-dialog.tsx",
    "app/(protected)/dashboard/enrollment/components/shs-student-participation-correction-history.tsx",
  ]) {
    const source = readFileSync(path.join(root, file), "utf8");
    assert.match(source, /getShs(?:CurriculumStatus|SubjectClassification)Label/);
  }
});
