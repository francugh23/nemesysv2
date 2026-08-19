import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { hasPermission, Permissions } from "../../lib/permissions";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("interpretation policy actions and services independently require GRADES authority", () => {
  assert.equal(hasPermission("SUPER_ADMIN", Permissions.GRADES), true);
  assert.equal(hasPermission("REGISTRAR", Permissions.GRADES), false);
  assert.equal(hasPermission("PRINCIPAL", Permissions.GRADES), false);
  assert.equal(hasPermission("TEACHER", Permissions.GRADES), false);
  const action = source("actions/shs-term-result-interpretation-policy.action.ts");
  const service = source("services/shs-term-result-interpretation-policy.service.ts");
  assert.equal((action.match(/requirePermission\(Permissions\.GRADES\)/g) ?? []).length, 3);
  assert.equal((service.match(/requirePermission\(Permissions\.GRADES\)/g) ?? []).length, 3);
  assert.doesNotMatch(action + service, /SubjectAssignment|finalGrade/);
});

test("Academic Year Details limits policy management to Super Admin and ACTIVE years", () => {
  const page = source("app/(protected)/dashboard/academic-years/page.tsx");
  const view = source("app/(protected)/dashboard/academic-years/components/academic-year-view-dialog.tsx");
  const dialog = source("app/(protected)/dashboard/academic-years/components/shs-term-result-interpretation-policy-dialog.tsx");
  const manager = source("app/(protected)/dashboard/academic-years/components/shs-term-result-interpretation-policy-manager.tsx");
  assert.match(page, /canManageInterpretationPolicy = hasPermission\([\s\S]*Permissions\.GRADES/);
  assert.match(view, /canManageInterpretationPolicy/);
  assert.match(dialog, /academicYear\.status === "ACTIVE"/);
  assert.match(manager, /Passing Threshold/);
  assert.match(manager, /75\.00/);
  assert.match(manager, /School-Approved Reference/);
  assert.match(manager, /Publication is permanent/);
  assert.match(manager, /subject completion, credits, promotion, or graduation/);
});

test("Enrollment Details displays only derived Term interpretation and missing-policy state", () => {
  const list = source("app/(protected)/dashboard/enrollment/components/student-subject-enrollment-list.tsx");
  const service = source("services/student-subject-enrollment.service.ts");
  assert.match(list, /term\.result\.interpretation\.outcome/);
  assert.match(list, /Interpretation policy not published/);
  assert.match(list, /Term Result interpretation only/);
  assert.match(service, /interpretFinalizedShsTermResult/);
  assert.doesNotMatch(service, /SubjectAssignment|finalGrade|EnrollmentStatus\.COMPLETED/);
});

test("publishing invalidates policy and all affected Enrollment result reads while draft saves do not", () => {
  const hook = source("hooks/shs-term-result-interpretation-policy.hook.ts");
  assert.match(hook, /\["shs-term-result-interpretation-policy", academicYearId\]/);
  assert.match(hook, /\["student-subject-enrollments"\]/);
  assert.match(hook, /invalidate\(values\.academicYearId, false\)/);
  assert.match(hook, /invalidate\(values\.academicYearId, true\)/);
});

test("21D-D remains isolated from finalization, completion, legacy Grade, JHS, and Subject Assignment", () => {
  const schema = source("prisma/schema.prisma");
  const resultMutation = source("services/shs-term-result-mutation.service.ts");
  const policyMutation = source("services/shs-term-result-interpretation-policy-mutation.service.ts");
  const jhs = source("services/jhs-student-subject-enrollment-derivation.service.ts");
  assert.match(schema, /model ShsTermResultInterpretationPolicy \{/);
  assert.match(schema, /model Grade \{/);
  assert.match(schema, /finalGrade Float\?/);
  assert.doesNotMatch(resultMutation, /InterpretationPolicy|passingThreshold/);
  assert.doesNotMatch(policyMutation, /studentSubjectEnrollment\.update|shsTermResult\.update|EnrollmentStatus|SubjectAssignment|finalGrade/);
  assert.doesNotMatch(jhs, /InterpretationPolicy|passingThreshold|PASSED|FAILED/);
});
