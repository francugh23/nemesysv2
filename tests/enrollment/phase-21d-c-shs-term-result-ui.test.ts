import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { hasPermission, Permissions } from "../../lib/permissions";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("SHS Term Result actions and services independently require GRADES authority", () => {
  assert.equal(hasPermission("SUPER_ADMIN", Permissions.GRADES), true);
  assert.equal(hasPermission("REGISTRAR", Permissions.GRADES), false);
  assert.equal(hasPermission("PRINCIPAL", Permissions.GRADES), false);
  assert.equal(hasPermission("TEACHER", Permissions.GRADES), false);
  const action = source("actions/shs-term-result.action.ts");
  const service = source("services/shs-term-result.service.ts");
  assert.equal((action.match(/requirePermission\(Permissions\.GRADES\)/g) ?? []).length, 3);
  assert.equal((service.match(/requirePermission\(Permissions\.GRADES\)/g) ?? []).length, 3);
  assert.doesNotMatch(action + service, /SubjectAssignment|Permissions\.ENROLLMENT/);
});

test("Enrollment Details shows exact-Term SHS evidence and excludes history controls", () => {
  const list = source("app/(protected)/dashboard/enrollment/components/student-subject-enrollment-list.tsx");
  const dialog = source("app/(protected)/dashboard/enrollment/components/shs-term-result-dialog.tsx");
  assert.match(list, /term\.result\.status/);
  assert.match(list, /term\.result\.authoritativeFinalResult/);
  assert.match(list, /row\.status === "ACTIVE"/);
  assert.match(list, /StudentSubjectEnrollmentTable rows=\{replacedRows\} showResults=\{isShs\}/);
  assert.match(list, /StudentSubjectEnrollmentTable rows=\{droppedRows\} showDropDetails showResults=\{isShs\}/);
  assert.match(dialog, /Finalization requires a value from 0\.00 to 100\.00/);
  assert.match(dialog, /evidence only/);
  assert.match(dialog, /does not\s+determine passing, completion, credits, or progression/);
});

test("result mutations invalidate only the Enrollment-scoped participation query", () => {
  const hook = source("hooks/student-subject-enrollment.hook.ts");
  const body = hook.match(/function useShsTermResultInvalidation[\s\S]*?\n}\n/)?.[0];
  assert.ok(body);
  assert.match(body, /\["student-subject-enrollments", enrollmentId\]/);
  assert.equal((body.match(/invalidateQueries/g) ?? []).length, 1);
  assert.doesNotMatch(body, /shs-current-term-progression/);
});

test("21D-C remains additive and does not repurpose legacy Grade or JHS derivation", () => {
  const schema = source("prisma/schema.prisma");
  const service = source("services/shs-term-result.service.ts");
  const jhs = source("services/jhs-student-subject-enrollment-derivation.service.ts");
  assert.match(schema, /model Grade \{/);
  assert.match(schema, /finalGrade Float\?/);
  assert.match(schema, /model ShsTermResult \{/);
  assert.doesNotMatch(service, /\.grade\.|finalGrade|firstQuarter|SubjectAssignment/);
  assert.doesNotMatch(jhs, /ShsTermResult|TermResult/);
});
