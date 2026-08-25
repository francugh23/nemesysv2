import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function between(contents: string, start: string, end?: string) {
  const startIndex = contents.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing contract marker: ${start}`);
  const endIndex = end ? contents.indexOf(end, startIndex + start.length) : contents.length;
  assert.notEqual(endIndex, -1, `Missing contract marker: ${end}`);
  return contents.slice(startIndex, endIndex);
}

test("C1 uses a distinct immutable SHS one-to-one correction event", () => {
  const schema = source("prisma/schema.prisma");
  const eventModel = between(schema, "model ShsStudentParticipationCorrection {", "model AcademicYear {");
  const migration = source("prisma/migrations/20260825000000_phase21f_c1_shs_participation_correction/migration.sql");

  assert.match(schema, /enum ShsStudentParticipationCorrectionKind[\s\S]*CORE[\s\S]*ACADEMIC_ELECTIVE[\s\S]*TECHPRO_ELECTIVE/);
  assert.match(eventModel, /sourceStudentSubjectEnrollmentId\s+String\s+@unique/);
  assert.match(eventModel, /replacementStudentSubjectEnrollmentId\s+String\s+@unique/);
  assert.match(eventModel, /sourceAcademicTermId\s+String/);
  assert.match(eventModel, /replacementAcademicTermId\s+String/);
  assert.match(eventModel, /plannedTermScopeSnapshot\s+Json/);
  assert.match(eventModel, /sourceResultStateSnapshot\s+Json/);
  assert.match(migration, /ShsStudentParticipationCorrection_sourceMembership_fkey/);
  assert.match(migration, /ShsStudentParticipationCorrection_replacementMembership_fkey/);
  assert.match(migration, /ShsStudentParticipationCorrection_assert_immutable_trigger[\s\S]*BEFORE UPDATE OR DELETE/);
});

test("C1 requires dedicated active capability and blocks generic SHS replacement", () => {
  const migration = source("prisma/migrations/20260825000000_phase21f_c1_shs_participation_correction/migration.sql");
  const lifecycle = between(migration, 'CREATE OR REPLACE FUNCTION "StudentSubjectEnrollment_assert_lifecycle_transition"()', 'CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_validate_completion"()');

  assert.match(migration, /nemesys\.shs_student_participation_correction_id/);
  assert.match(migration, /pg_advisory_xact_lock\(2108/);
  assert.match(migration, /pg_xact_status\(correction\.xmin::TEXT::xid8\) = 'in progress'/);
  assert.match(lifecycle, /OLD\."gradeLevel" IN \('11', '12'\)/);
  assert.match(lifecycle, /ShsStudentParticipationCorrection_event_is_active/);
  assert.match(lifecycle, /exact active participation correction mapping/);
  assert.match(lifecycle, /nemesys\.shs_progressive_core_replacement_id/);
});

test("C1 service derives safe Core scope and blocks result, lineage, policy, and duplicate bypasses", () => {
  const mutation = source("services/shs-student-participation-correction-mutation.service.ts");
  const action = source("actions/shs-student-participation-correction.action.ts");
  const service = source("services/shs-student-participation-correction.service.ts");

  assert.match(mutation, /source\.terms\.some\(\(\{ resultId \}\) => resultId !== null\)/);
  assert.match(mutation, /position >= sourceTerm\.position/);
  assert.match(mutation, /sourceTermIds\.length !== 1/);
  assert.match(mutation, /replacementOffering\.classification !== source\.shsClassification/);
  assert.match(mutation, /lockShsParticipationCorrectionPolicy/);
  assert.match(mutation, /findOfferingReplacementAncestors/);
  assert.match(mutation, /droppedOfferingIds/);
  assert.match(mutation, /activeDuplicate/);
  assert.match(mutation, /executeShsParticipationCorrection\(\{/);
  assert.doesNotMatch(mutation, /data:\s*\{[^}]*status:\s*"DROPPED"/);
  assert.match(action, /requirePermission\(Permissions\.STUDENT_CORRECTIONS\)/);
  assert.match(service, /requirePermission\(Permissions\.STUDENT_CORRECTIONS\)/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
});

test("all shared dialog shells bound dynamic viewport overflow", () => {
  const dialog = source("components/ui/dialog.tsx");
  const alertDialog = source("components/ui/alert-dialog.tsx");
  const formDialog = source("components/common/dialogs/form-dialog.tsx");
  const correctionDialog = source("app/(protected)/dashboard/enrollment/components/correct-enrollment-placement-dialog.tsx");

  assert.match(dialog, /max-h-\[calc\(100dvh-2rem\)\] .*overflow-y-auto/);
  assert.match(alertDialog, /max-h-\[calc\(100dvh-2rem\)\] .*overflow-y-auto/);
  assert.match(formDialog, /max-h-\[90dvh\] flex-col overflow-hidden/);
  assert.match(formDialog, /min-h-0 flex-1 overflow-y-auto/);
  assert.match(correctionDialog, /max-h-\[92dvh\].*overflow-hidden/);
});
