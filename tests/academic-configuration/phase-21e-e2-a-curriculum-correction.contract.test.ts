import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = process.cwd();
const readSource = (path: string) => readFile(`${root}/${path}`, "utf8");

test("E2-A authorizes at Action and Service boundaries and owns one serializable transaction", async () => {
  const [action, service, permissions] = await Promise.all([
    readSource("actions/subject-offering.action.ts"),
    readSource("services/curriculum-correction.service.ts"),
    readSource("lib/permissions.ts"),
  ]);
  assert.match(action, /correctSubjectOfferingAction[\s\S]*auth\(\)/);
  assert.match(service, /authorizeCorrection[\s\S]*Permissions\.SUBJECTS/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /MAX_TRANSACTION_ATTEMPTS = 3/);
  assert.match(service, /P2034/);
  assert.match(service, /40001/);
  assert.match(service, /40P01/);
  assert.match(permissions, /\[Permissions\.SUBJECTS\]: \["SUPER_ADMIN"\]/);
});

test("E2-A lock order and atomic write set preserve student and finalization history", async () => {
  const [service, repository] = await Promise.all([
    readSource("services/curriculum-correction.service.ts"),
    readSource("repositories/curriculum-correction.repository.ts"),
  ]);
  const order = [
    "lockAcademicYearsForCurriculumMutation",
    "lockOfferingForMutation",
    "lockCorrectionIdentityConflicts",
    "lockCorrectionTermAndClusterScopes",
    "lockCorrectionPolicyScopes",
    "lockCorrectionParticipationImpact",
  ].map((name) => service.indexOf(name, service.indexOf("correctSubjectOfferingInTransaction")));
  assert.ok(order.every((index) => index >= 0));
  assert.deepEqual([...order].sort((left, right) => left - right), order);
  assert.match(service, /createCurriculumCorrectionIntent[\s\S]*archiveCorrectionSource[\s\S]*createCorrectionReplacement[\s\S]*createAuditLogs/);
  assert.doesNotMatch(repository, /studentSubjectEnrollment\.(?:update|delete|create)/);
  assert.doesNotMatch(repository, /shsTermResult\.(?:update|delete|create)/);
  assert.doesNotMatch(repository, /enrollment\.(?:update|delete|create)/);
  assert.doesNotMatch(repository, /curriculumFinalization\.(?:update|delete|create)/);
});

test("E2-A database protocol scopes the E1 exception to exact correction identities", async () => {
  const [migration, completion] = await Promise.all([
    readSource("prisma/migrations/20260823000000_phase21e_e2_a_curriculum_correction_foundation/migration.sql"),
    readSource("prisma/migrations/20260823002000_phase21e_e2_a_authoritative_guard_completion/migration.sql"),
  ]);
  assert.match(migration, /current_setting\('nemesys\.curriculum_correction_id', true\)/);
  assert.match(migration, /correction\."sourceOfferingId" = NEW\."replacesSubjectOfferingId"/);
  assert.match(migration, /correction\."replacementOfferingId" = NEW\."id"/);
  assert.match(migration, /authorized_source_archive/);
  assert.match(migration, /authorized_successor_create/);
  assert.match(migration, /authorized_successor_child/);
  assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(migration, /Curriculum correction records are immutable/);
  assert.doesNotMatch(migration, /bypass(?:ed)?\s+BOOLEAN/i);
  assert.match(completion, /academic_year_status IS DISTINCT FROM 'ACTIVE'/);
  assert.match(completion, /unavailable during an active Academic Term/);
  assert.match(completion, /effective Term must be future and unstarted/);
  assert.match(completion, /replacement_grade IS DISTINCT FROM source_grade/);
  assert.match(completion, /CurriculumCorrection_offering_snapshot/);
  assert.match(completion, /sourceConfigurationSnapshot" IS DISTINCT FROM/);
  assert.match(completion, /replacementConfigurationSnapshot" IS DISTINCT FROM/);
  assert.match(completion, /JHS Curriculum correction must be effective before Term 1/);
  assert.match(completion, /SHS Curriculum correction Terms cannot precede the effective Term/);
});

test("E2-A UI is focused, explicit, and leaves ordinary E1 actions blocked", async () => {
  const [columns, dialog, page] = await Promise.all([
    readSource("app/(protected)/dashboard/subject-offerings/components/subject-offering-columns.tsx"),
    readSource("app/(protected)/dashboard/subject-offerings/components/curriculum-correction-dialog.tsx"),
    readSource("app/(protected)/dashboard/subject-offerings/page.tsx"),
  ]);
  assert.match(columns, /Correct \/ Replace/);
  assert.match(columns, /Replacement/);
  assert.match(columns, /Replaces/);
  assert.match(columns, /!finalized[\s\S]*Archive/);
  assert.match(dialog, /Existing students and historical results remain attached to the original Offering\. The replacement applies prospectively only\./);
  assert.match(dialog, /Correction reason/);
  assert.match(dialog, /Evidence \/ Reference/);
  assert.match(dialog, /type the predecessor Subject code/);
  assert.match(dialog, /Predecessor: Replaced/);
  assert.match(page, /hasPermission\(session\?\.user\.role, Permissions\.SUBJECTS\)/);
});

test("E2-A adoption keeps active-only copy behavior and does not copy lineage", async () => {
  const [adoptionRepository, adoptionService] = await Promise.all([
    readSource("repositories/curriculum-adoption.repository.ts"),
    readSource("services/curriculum-adoption.service.ts"),
  ]);
  assert.match(adoptionService, /SOURCE_OFFERING_ARCHIVED/);
  assert.doesNotMatch(adoptionRepository, /replacesSubjectOfferingId\s*:/);
  assert.doesNotMatch(adoptionRepository, /curriculumCorrection\.(?:create|update)/);
});
