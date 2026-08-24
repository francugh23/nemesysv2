import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { hasPermission, Permissions } from "../../lib/permissions";
import { CorrectStudentEnrollmentPlacementSchema } from "../../schemas/enrollment.schema";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("correction input requires destination, reason, evidence, and confirmation", () => {
  assert.equal(CorrectStudentEnrollmentPlacementSchema.safeParse({}).success, false);
  assert.equal(CorrectStudentEnrollmentPlacementSchema.safeParse({
    sourceSectionId: "source-section",
    destinationSectionId: "section",
    reason: "Administrative mistake",
    evidenceReference: "Enrollment form",
    confirmed: true,
  }).success, true);
  assert.equal(CorrectStudentEnrollmentPlacementSchema.safeParse({
    sourceSectionId: "source-section",
    destinationSectionId: "section",
    reason: "   ",
    evidenceReference: "Enrollment form",
    confirmed: true,
  }).success, false);
});

test("dedicated permission allows only Super Admin and Registrar", () => {
  assert.equal(hasPermission("SUPER_ADMIN", Permissions.STUDENT_CORRECTIONS), true);
  assert.equal(hasPermission("REGISTRAR", Permissions.STUDENT_CORRECTIONS), true);
  assert.equal(hasPermission("PRINCIPAL", Permissions.STUDENT_CORRECTIONS), false);
  assert.equal(hasPermission("TEACHER", Permissions.STUDENT_CORRECTIONS), false);
  const action = source("actions/student-enrollment-correction.action.ts");
  const service = source("services/student-enrollment-correction.service.ts");
  assert.equal((action.match(/requirePermission\(Permissions\.STUDENT_CORRECTIONS\)/g) ?? []).length, 2);
  assert.equal((service.match(/requirePermission\(Permissions\.STUDENT_CORRECTIONS\)/g) ?? []).length, 2);
  assert.doesNotMatch(action, /Permissions\.ENROLLMENT/);
  assert.doesNotMatch(service, /Permissions\.ENROLLMENT/);
});

test("service uses serializable retry and does not invoke participation reconciliation", () => {
  const service = source("services/student-enrollment-correction.service.ts");
  const mutation = source("services/student-enrollment-correction-mutation.service.ts");
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /MAX_TRANSACTION_ATTEMPTS = 3/);
  assert.match(mutation, /lockStudentForEnrollmentSynchronization[\s\S]*lockEnrollmentForStudentCorrection[\s\S]*lockAcademicYearForStudentCorrection[\s\S]*lockSectionsForStudentCorrection[\s\S]*lockStudentCorrectionConflicts/);
  assert.match(mutation, /if \(!values\.confirmed\)/);
  assert.doesNotMatch(mutation, /reconcileApprovedRegularJhsStudentSubjectEnrollments|replaceActiveStudentSubjectEnrollment|dropActiveStudentSubjectEnrollment/);
});

test("migration uses an exact event context and preserves existing protection domains", () => {
  const migration = source("prisma/migrations/20260824001000_phase21f_a_controlled_enrollment_placement_correction/migration.sql");
  assert.match(migration, /nemesys\.student_enrollment_correction_id/);
  assert.match(migration, /StudentEnrollmentCorrection_assert_immutable/);
  assert.match(migration, /sourceSectionId[\s\S]*<>[\s\S]*destinationSectionId/);
  assert.match(migration, /same grade level/);
  assert.match(migration, /source does not match current placement/);
  assert.doesNotMatch(migration, /bypass|disable_trigger|CurriculumCorrection|StudentSubjectEnrollment|ShsTermResult/);
  const revalidation = source("prisma/migrations/20260824002000_phase21f_a_correction_revalidation_completion/migration.sql");
  assert.match(revalidation, /correction\.xmin::TEXT = pg_current_xact_id\(\)::TEXT/);
  assert.match(revalidation, /enrollment_revalidation_trigger/);
  assert.match(revalidation, /academic_year_revalidation_trigger/);
  assert.match(revalidation, /section_revalidation_trigger/);
  const identityGuard = source("prisma/migrations/20260824003000_phase21f_a_enrollment_identity_snapshot_guard/migration.sql");
  assert.match(identityGuard, /sourcePlacementSnapshot"->>'studentId'/);
  assert.match(identityGuard, /sourcePlacementSnapshot"->>'academicYearId'/);
  assert.match(identityGuard, /sourcePlacementSnapshot"->>'entryAcademicTermId'/);
  assert.match(identityGuard, /changed protected Enrollment identity, lifecycle, or entry facts/);
  const createdAtGuard = source("prisma/migrations/20260824004000_phase21f_a_enrollment_created_at_guard/migration.sql");
  assert.match(createdAtGuard, /enrollmentCreatedAtSnapshot/);
  assert.match(createdAtGuard, /created_at_revalidation_trigger/);
  const replayGuard = source("prisma/migrations/20260824005000_phase21f_a_correction_event_replay_guard/migration.sql");
  assert.match(replayGuard, /correction\.xmin::TEXT = pg_current_xact_id\(\)::TEXT/);
  assert.match(replayGuard, /MAX\(correction\.cmin::TEXT::BIGINT\)/);
  assert.match(replayGuard, /newest Student Enrollment Correction event/);
  const durableReplayGuard = source("prisma/migrations/20260824006000_phase21f_a_durable_correction_replay_guard/migration.sql");
  assert.match(durableReplayGuard, /"sequence" BIGSERIAL/);
  assert.match(durableReplayGuard, /MAX\(correction\."sequence"\)/);
  const subtransactionGuard = source("prisma/migrations/20260824007000_phase21f_a_subtransaction_safe_replay_guard/migration.sql");
  assert.match(subtransactionGuard, /MAX\(correction\."sequence"\)/);
  assert.doesNotMatch(subtransactionGuard, /xmin|pg_current_xact_id/);
  const subtransactionRevalidation = source("prisma/migrations/20260824008000_phase21f_a_subtransaction_revalidation_guard/migration.sql");
  assert.match(subtransactionRevalidation, /pg_advisory_xact_lock\(2106/);
  assert.match(subtransactionRevalidation, /JOIN pg_locks/);
  assert.match(subtransactionRevalidation, /StudentEnrollmentCorrection_active_transaction_event_id/);
  const scopedRevalidation = source("prisma/migrations/20260824009000_phase21f_a_scoped_revalidation_completion/migration.sql");
  assert.match(scopedRevalidation, /WHERE correction\."enrollmentId" = NEW\."id"/);
  assert.match(scopedRevalidation, /WHERE enrollment\."studentId" = NEW\."id"/);
  assert.match(scopedRevalidation, /sourcePlacementSnapshot"->>'gradeLevel'/);
  assert.match(scopedRevalidation, /destinationPlacementSnapshot"->>'gradeLevel'/);
  const sectionIsolation = source("prisma/migrations/20260824010000_phase21f_a_section_mutation_isolation_guard/migration.sql");
  assert.match(sectionIsolation, /Sections in a Student Enrollment Correction transaction cannot change grade or archive state/);
  assert.match(sectionIsolation, /JOIN pg_locks/);
  const evidenceIsolation = source("prisma/migrations/20260824011000_phase21f_a_participation_evidence_isolation_guard/migration.sql");
  assert.match(evidenceIsolation, /StudentEnrollmentCorrection_has_active_enrollment/);
  assert.match(evidenceIsolation, /StudentSubjectEnrollmentTerm/);
  assert.match(evidenceIsolation, /ShsTermResult/);
  assert.match(evidenceIsolation, /cannot mutate participation, Term, result, or Grade evidence/);
  const orderingIsolation = source("prisma/migrations/20260824012000_phase21f_a_transaction_ordering_isolation_guard/migration.sql");
  assert.match(orderingIsolation, /StudentEnrollmentCorrection_mark_prior_mutation/);
  assert.match(orderingIsolation, /StudentEnrollmentCorrection_assert_no_prior_mutation/);
  const strictIsolation = source("prisma/migrations/20260824013000_phase21f_a_strict_transaction_isolation_guard/migration.sql");
  assert.match(strictIsolation, /pg_xact_status\(correction\.xmin::TEXT::xid8\) = 'in progress'/);
  assert.match(strictIsolation, /newest in-transaction Student Enrollment Correction event/);
  assert.match(strictIsolation, /source Section must be active/);
  assert.match(strictIsolation, /requires an active Student/);
  assert.match(strictIsolation, /BEFORE DELETE ON "Section"/);
  assert.doesNotMatch(strictIsolation, /xmin::TEXT = pg_current_xact_id|Atomic creation may materialize evidence/);
});

test("Enrollment Details owns a focused workflow and compact immutable history", () => {
  const view = source("app/(protected)/dashboard/enrollment/components/enrollment-view-dialog.tsx");
  const dialog = source("app/(protected)/dashboard/enrollment/components/correct-enrollment-placement-dialog.tsx");
  const history = source("app/(protected)/dashboard/enrollment/components/student-enrollment-correction-history.tsx");
  const actions = source("app/(protected)/dashboard/enrollment/components/enrollment-actions.tsx");
  assert.match(view, /Correct Placement/);
  assert.match(view, /StudentEnrollmentCorrectionHistory/);
  assert.doesNotMatch(actions, /Correct placement|onEdit/);
  assert.match(dialog, /Grade is not changing/);
  assert.match(dialog, /Student Subject Enrollments, SSE Terms, and results/);
  assert.match(dialog, /permanent, audited historical placement correction/);
  assert.match(dialog, /Evidence \/ Reference/);
  assert.match(dialog, /flex max-h-\[92dvh\][\s\S]*overflow-hidden p-0/);
  assert.match(dialog, /ScrollArea className="min-h-0 flex-1"/);
  assert.match(dialog, /DialogFooter className="mx-0 mb-0 shrink-0/);
  assert.match(history, /Placement Correction History/);
  assert.match(history, /Corrected by/);
  assert.match(history, /Evidence \/ Reference/);
  const manager = source("app/(protected)/dashboard/enrollment/components/enrollment-dialog-manager.tsx");
  assert.match(manager, /key=\{`\$\{enrollment\.id\}-\$\{instanceId\}`\}/);
  assert.match(manager, /canCorrectPlacement &&/);
  assert.match(manager, /canOpenPlacementCorrection[\s\S]*enrollment\.status === "ACTIVE"[\s\S]*enrollment\.academicYearStatus === "ACTIVE"/);
  assert.match(view, /canViewPlacementCorrections \?/);
  const page = source("app/(protected)/dashboard/enrollment/page.tsx");
  assert.match(page, /hasPermission\([\s\S]*Permissions\.STUDENT_CORRECTIONS/);
  assert.match(page, /canCorrectPlacement=\{canCorrectPlacement\}/);
});

test("placement correction invalidates only Enrollment, Student, and correction-history keys", () => {
  const hook = source("hooks/enrollment.hook.ts");
  const body = hook.match(/export function useCorrectStudentEnrollmentPlacement\(\)[\s\S]*?\n}\n\nexport function useTransitionEnrollment/)?.[0];
  assert.ok(body);
  assert.match(body, /\["enrollments"\]/);
  assert.match(body, /\["students"\]/);
  assert.match(body, /\["student-enrollment-corrections", values\.id\]/);
  assert.match(body, /\["enrollment-filter-options"\]/);
  assert.equal((body.match(/invalidateQueries/g) ?? []).length, 4);
  assert.doesNotMatch(body, /\["student-subject-enrollments"|\["shs-current-term-progression"|\["subject-offerings"|\["curriculum|\["shs-term-result/i);
});
