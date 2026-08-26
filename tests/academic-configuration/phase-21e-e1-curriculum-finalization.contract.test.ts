import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = process.cwd();
const read = (path: string) => readFile(`${root}/${path}`, "utf8");

test("finalization uses existing Super Admin permission at Action and Service boundaries with atomic audit", async () => {
  const [action, service, permissions] = await Promise.all([
    read("actions/curriculum-finalization.action.ts"),
    read("services/curriculum-finalization.service.ts"),
    read("lib/permissions.ts"),
  ]);
  assert.match(action, /requirePermission\(Permissions\.SUBJECTS\)/);
  assert.match(service, /requirePermission\(Permissions\.SUBJECTS\)/);
  assert.match(permissions, /\[Permissions\.SUBJECTS\]: \["SUPER_ADMIN"\]/);
  assert.match(service, /prisma\.\$transaction[\s\S]*createCurriculumFinalization[\s\S]*createAuditLogs/);
  assert.match(service, /active SHS Offering[\s\S]*Complete, approve, or archive/);
});

test("Academic Year-first locks serialize finalization, Offering, approval, archive, and policy mutation", async () => {
  const [finalization, offering, policy, repository, migration] = await Promise.all([
    read("services/curriculum-finalization.service.ts"),
    read("services/subject-offering.service.ts"),
    read("services/shs-elective-enrollment-policy.service.ts"),
    read("repositories/curriculum-finalization.repository.ts"),
    read("prisma/migrations/20260822002000_phase21e_e1_race_guard_completion/migration.sql"),
  ]);
  assert.match(repository, /ORDER BY academic_year\."id"[\s\S]*FOR UPDATE/);
  assert.match(finalization, /lockAcademicYearsForCurriculumMutation[\s\S]*countPendingShsOfferings[\s\S]*createCurriculumFinalization/);
  assert.match(offering, /lockAcademicYearsForCurriculumMutation[\s\S]*lockOfferingForMutation/);
  assert.match(policy, /lockAcademicYearsForCurriculumMutation[\s\S]*lockShsElectiveEnrollmentPolicy/);
  assert.match(policy, /createShsElectiveEnrollmentPolicyInTransaction[\s\S]*hasShsParticipationForPolicyScope/);
  assert.match(migration, /SubjectOfferingTerm_enforce_curriculum_lock[\s\S]*ORDER BY "id" FOR UPDATE/);
  assert.match(migration, /SubjectOfferingShsContext_enforce_curriculum_lock[\s\S]*ORDER BY "id" FOR UPDATE/);
  assert.match(migration, /TG_OP = 'INSERT'[\s\S]*ShsElectiveEnrollmentPolicy_scope_has_participation/);
});

test("finalization remains independent from Enrollment, progression, drop, results, and Academic Year lifecycle", async () => {
  const [schema, migration, service] = await Promise.all([
    read("prisma/schema.prisma"),
    read("prisma/migrations/20260822000000_phase21e_e1_curriculum_finalization/migration.sql"),
    read("services/curriculum-finalization.service.ts"),
  ]);
  assert.match(schema, /model CurriculumFinalization/);
  assert.doesNotMatch(schema, /enum CurriculumFinalizationStatus/);
  assert.doesNotMatch(schema.match(/model CurriculumFinalization \{[\s\S]*?\n\}/)?.[0] ?? "", /\sstatus\s/);
  assert.doesNotMatch(migration, /UPDATE "AcademicYear"|UPDATE "SubjectOffering"|INSERT INTO "CurriculumFinalization"/);
  assert.doesNotMatch(service, /transitionAcademicYearStatus|Enrollment|ShsTermResult/);
});

test("adoption never copies finalization or SHS approval and keeps existing source statuses", async () => {
  const [service, repository] = await Promise.all([
    read("services/curriculum-adoption.service.ts"),
    read("repositories/curriculum-adoption.repository.ts"),
  ]);
  assert.match(service, /\["ACTIVE", "LOCKED", "ARCHIVED"\]/);
  assert.match(service, /destinationYear\.status !== "DRAFT"/);
  assert.match(repository, /curriculumStatus: "PROVISIONAL_DEPED"/);
  assert.match(repository, /approvalReference: null/);
  assert.doesNotMatch(repository, /curriculumFinalization|finalizedAt|finalizedById/);
});

test("UI distinguishes configurable, finalized, historical, participation-locked, and pending states", async () => {
  const [details, dialog, columns, presentation] = await Promise.all([
    read("app/(protected)/dashboard/academic-years/components/academic-year-view-dialog.tsx"),
    read("app/(protected)/dashboard/academic-years/components/curriculum-finalization-dialog.tsx"),
    read("app/(protected)/dashboard/subject-offerings/components/subject-offering-columns.tsx"),
    read("lib/shs-presentation.ts"),
  ]);
  assert.match(details, /Configurable/);
  assert.match(details, /Finalized/);
  assert.match(details, /Historical/);
  assert.match(dialog, /does not close Enrollment, SHS progression, results, or the Academic Year/);
  assert.match(dialog, /Missing grade coverage or elective-policy scopes remain warnings/);
  assert.match(columns, /Locked by Student Participation/);
  assert.match(columns, /getShsCurriculumStatusLabel\(context\.curriculumStatus\)/);
  assert.match(presentation, /PROVISIONAL_DEPED: "Pending School Approval"/);
  assert.match(columns, /!finalized/);
});
