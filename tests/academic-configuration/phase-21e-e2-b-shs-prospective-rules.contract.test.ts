import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = process.cwd();
const readSource = (path: string) => readFile(`${root}/${path}`, "utf8");

test("E2-B derives immediate-next effective and exact remaining source Terms", async () => {
  const [service, migration, dialog] = await Promise.all([
    readSource("services/curriculum-correction.service.ts"),
    readSource("prisma/migrations/20260823003000_phase21e_e2_b_shs_prospective_rules/migration.sql"),
    readSource("app/(protected)/dashboard/subject-offerings/components/curriculum-correction-dialog.tsx"),
  ]);
  assert.match(service, /deriveCorrectionPlan/);
  assert.match(service, /futureTerms\[0\]/);
  assert.match(service, /sourceTermIds\.has\(term\.id\)/);
  assert.match(service, /Replacement Terms must exactly match the predecessor's remaining applicable Terms/);
  assert.match(migration, /immediately next unstarted Academic Term/);
  assert.match(migration, /retain every remaining source Academic Term/);
  assert.match(migration, /exactly equal the remaining source Term set/);
  assert.doesNotMatch(dialog, /Replacement Term applicability|setAcademicTermIds|onCheckedChange/);
  assert.match(dialog, /Derived successor Terms/);
});

test("E2-B enforces classification, cluster, policy, and independent approval facts", async () => {
  const [service, migration, repository, dialog] = await Promise.all([
    readSource("services/curriculum-correction.service.ts"),
    readSource("prisma/migrations/20260823003000_phase21e_e2_b_shs_prospective_rules/migration.sql"),
    readSource("repositories/curriculum-correction.repository.ts"),
    readSource("app/(protected)/dashboard/subject-offerings/components/curriculum-correction-dialog.tsx"),
  ]);
  assert.match(service, /lockCorrectionPolicyScopes/);
  assert.match(service, /policies\.length !== derivedTermIds\.length/);
  assert.match(service, /Replacement provenance must be newly supplied/);
  assert.match(service, /Replacement approval reference must independently evidence/);
  assert.match(migration, /active school-facing cluster/);
  assert.match(migration, /existing policy for every replacement Term/);
  assert.match(migration, /newly supplied provenance/);
  assert.match(migration, /independent approval evidence/);
  assert.match(migration, /approval facts must match the correction actor and timestamp/);
  assert.match(repository, /curriculumStatus: "SCHOOL_APPROVED"/);
  assert.match(repository, /approvedById: actorId/);
  assert.match(repository, /approvedAt: correctedAt/);
  assert.match(dialog, /Compatible elective policies exist for every successor Term/);
  assert.match(dialog, /Source \/ Provenance Reference/);
  assert.match(dialog, /School Approval Reference/);
});

test("E2-B lineage continuation is classification-compatible and DROP blocks descendants", async () => {
  const [repository, selection, readService] = await Promise.all([
    readSource("repositories/student-subject-enrollment.repository.ts"),
    readSource("services/student-subject-enrollment-selection.service.ts"),
    readSource("services/student-subject-enrollment.service.ts"),
  ]);
  assert.match(repository, /continuationKind/);
  assert.match(repository, /'CORE'[\s\S]*next_context\."classification" = 'CORE'/);
  assert.match(repository, /'ELECTIVE'[\s\S]*next_context\."classification" IN \('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE'\)/);
  assert.match(selection, /droppedAncestorIdentities/);
  assert.match(selection, /replacement descendants remain blocked for the Academic Year/);
  assert.match(readService, /droppedAncestorIdentities/);
  assert.doesNotMatch(selection, /studentSubjectEnrollment\.(?:update|delete).*ancestor/i);
});

test("E2-B excludes partial-year correction successors from adoption without copying lineage", async () => {
  const [eligibility, repository] = await Promise.all([
    readSource("services/curriculum-adoption-eligibility.service.ts"),
    readSource("repositories/curriculum-adoption.repository.ts"),
  ]);
  assert.match(eligibility, /PARTIAL_YEAR_CORRECTION_SUCCESSOR/);
  assert.match(eligibility, /not a complete next-year Curriculum baseline/);
  assert.match(repository, /replacesSubjectOffering[\s\S]*terms/);
  assert.doesNotMatch(repository, /replacesSubjectOfferingId:\s*source/);
  assert.doesNotMatch(repository, /curriculumCorrection\.(?:create|update)/);
});

test("E2-B UI states the school-Curriculum-only historical boundary", async () => {
  const dialog = await readSource("app/(protected)/dashboard/subject-offerings/components/curriculum-correction-dialog.tsx");
  assert.match(dialog, /Existing students remain on the historical Offering\. The replacement applies prospectively only\./);
  assert.match(dialog, /Student-specific placement or enrollment errors are not corrected here\./);
  assert.match(dialog, /Lineage preview/);
  assert.match(dialog, /Historical predecessor/);
  assert.match(dialog, /Prospective successor/);
});
