import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { hasPermission, Permissions } from "../../lib/permissions";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Enrollment details exposes only the progressive current-Term SHS selection path", () => {
  const view = source("app/(protected)/dashboard/enrollment/components/enrollment-view-dialog.tsx");
  const selection = source("app/(protected)/dashboard/enrollment/components/shs-current-term-subject-selection.tsx");
  const action = source("actions/student-subject-enrollment.action.ts");
  const hook = source("hooks/student-subject-enrollment.hook.ts");
  const legacyPath = path.join(
    process.cwd(),
    "app/(protected)/dashboard/enrollment/components/shs-curriculum-selection.tsx",
  );

  assert.equal(existsSync(legacyPath), false);
  assert.match(view, /ShsCurrentTermSubjectSelection/);
  assert.doesNotMatch(view, /ShsCurriculumSelection/);
  assert.doesNotMatch(view, /key=\{enrollment\.id\}/);
  assert.match(selection, /server-resolved current Term/);
  assert.match(selection, /subjectOfferingIds: \[\.\.\.existingOfferingIds, \.\.\.validNewOfferingIds\]/);
  assert.doesNotMatch(selection, /academicTermId\s*:/);
  assert.doesNotMatch(selection, /<Select|useAcademicTerms|Term selector/i);
  assert.doesNotMatch(action, /selectShsCurriculumOfferingsAction/);
  assert.doesNotMatch(hook, /useSelectShsCurriculumOfferings/);
});

test("selection UI is additive, displays server/entry context, and has no removal control", () => {
  const selection = source("app/(protected)/dashboard/enrollment/components/shs-current-term-subject-selection.tsx");

  assert.match(selection, /Existing participation is read-only/);
  assert.match(selection, /label="Server Current Term"/);
  assert.match(selection, /label="Entry Term"/);
  assert.match(selection, /offering\.selected \|\|/);
  assert.match(selection, /offering\.selected \|\|\s*offering\.dropped/);
  assert.match(selection, /Omitted active rows\s+remain attached and are never removed/);
  assert.doesNotMatch(selection, />Remove</);
  assert.doesNotMatch(selection, />Replace</);
});

test("subject list renders mutually exclusive current, prior, replaced, and dropped history", () => {
  const list = source("app/(protected)/dashboard/enrollment/components/student-subject-enrollment-list.tsx");
  const dialog = source("app/(protected)/dashboard/enrollment/components/drop-student-subject-enrollment-dialog.tsx");

  assert.match(list, /Show replaced history/);
  assert.match(list, /Show dropped history/);
  assert.match(list, /const currentActiveRows = currentTerm/);
  assert.match(list, /const previousActiveRows = currentTerm/);
  assert.match(list, /Active Prior-Term History/);
  assert.match(list, /academicTermId === currentTerm\.id/);
  assert.match(list, /!row\.terms\.some/);
  assert.match(list, /Dropped rows retain their immutable Terms and recorded reason/);
  assert.match(list, /row\.terms\.some\([\s\S]*academicTermId === currentAcademicTermId/);
  assert.match(dialog, /marks the entire immutable subject enrollment row as DROPPED/);
  assert.match(dialog, /Every attached Term, including prior and future Terms/);
  assert.match(dialog, /parent Enrollment is unchanged and no\s+replacement is created/);
  assert.match(dialog, /Required, 1-500 characters/);
  assert.match(dialog, /below the policy minimum/);
});

test("successful progression and drop invalidate only both Enrollment-scoped cache keys", () => {
  const hook = source("hooks/student-subject-enrollment.hook.ts");
  const invalidationBody = hook.match(
    /function useStudentSubjectEnrollmentInvalidation[\s\S]*?\n}\n/,
  )?.[0];
  assert.ok(invalidationBody);
  assert.match(invalidationBody, /\["student-subject-enrollments", enrollmentId\]/);
  assert.match(invalidationBody, /\["shs-current-term-progression", enrollmentId\]/);
  assert.equal((invalidationBody.match(/invalidateQueries/g) ?? []).length, 2);
  assert.match(hook, /if \(!result\.error\) await invalidate\(\)/g);
});

test("policy, Offering, and Enrollment mutations refresh affected progression context", () => {
  const policyHook = source("hooks/shs-elective-enrollment-policy.hook.ts");
  const offeringHook = source("hooks/subject-offering.hook.ts");
  const enrollmentHook = source("hooks/enrollment.hook.ts");
  assert.match(policyHook, /\["shs-current-term-progression"\]/);
  assert.match(offeringHook, /\["shs-current-term-progression"\]/);
  assert.match(enrollmentHook, /\["shs-current-term-progression", values\.id\]/);
  assert.match(enrollmentHook, /\["shs-current-term-progression", id\]/);
  const sharedInvalidation = source("hooks/query-invalidation.ts");
  assert.match(sharedInvalidation, /\["shs-current-term-progression"\]/);
  assert.doesNotMatch(enrollmentHook, /eligible-shs-offerings/);
});

test("Academic Year Details exposes the bounded SHS elective policy manager", () => {
  const view = source("app/(protected)/dashboard/academic-years/components/academic-year-view-dialog.tsx");
  const manager = source("app/(protected)/dashboard/academic-years/components/shs-elective-enrollment-policy-manager.tsx");
  const action = source("actions/shs-elective-enrollment-policy.action.ts");
  assert.match(view, /ShsElectiveEnrollmentPolicyManager/);
  assert.match(manager, /const GRADES = \["11", "12"\]/);
  assert.match(manager, /const ELECTIVE_COUNTS = \[1, 2, 3\]/);
  assert.match(manager, /Minimum electives cannot exceed maximum electives/);
  assert.doesNotMatch(manager, /delete|seed|copy/i);
  assert.match(action, /requirePermission\(Permissions\.SHS_CURRICULUM_APPROVAL\)/);
});

test("B2 read and mutation actions and services independently use Enrollment authorization", () => {
  assert.equal(hasPermission("SUPER_ADMIN", Permissions.ENROLLMENT), true);
  assert.equal(hasPermission("REGISTRAR", Permissions.ENROLLMENT), true);
  assert.equal(hasPermission("PRINCIPAL", Permissions.ENROLLMENT), false);
  assert.equal(hasPermission("TEACHER", Permissions.ENROLLMENT), false);

  const action = source("actions/student-subject-enrollment.action.ts");
  const service = source("services/student-subject-enrollment.service.ts");
  assert.equal(
    (action.match(/requirePermission\(Permissions\.ENROLLMENT\)/g) ?? []).length >= 4,
    true,
  );
  assert.equal(
    (service.match(/requirePermission\(Permissions\.ENROLLMENT\)/g) ?? []).length >= 4,
    true,
  );
  assert.doesNotMatch(action, /Permissions\.SHS_CURRICULUM_APPROVAL/);
  assert.doesNotMatch(service, /Permissions\.SHS_CURRICULUM_APPROVAL/);
});
