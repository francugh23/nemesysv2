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

function assertOrdered(contents: string, markers: string[]) {
  let cursor = -1;
  for (const marker of markers) {
    const index = contents.indexOf(marker, cursor + 1);
    assert.ok(index > cursor, `Expected ${marker} after the previous contract step`);
    cursor = index;
  }
}

const migrationPath =
  "prisma/migrations/20260824014000_phase21f_b_jhs_grade_correction/migration.sql";
const replacementScopeHardeningMigrationPath =
  "prisma/migrations/20260824015000_phase21f_b_jhs_replacement_scope_hardening/migration.sql";

test("every Grade 7-10 replacement requires exact active correction mapping regardless of malformed snapshots", () => {
  const migration = source(replacementScopeHardeningMigrationPath);
  const lifecycle = between(
    migration,
    'CREATE OR REPLACE FUNCTION "StudentSubjectEnrollment_assert_lifecycle_transition"()',
  );

  assert.match(
    lifecycle,
    /OLD\."status" = 'ACTIVE' AND NEW\."status" = 'REPLACED'[\s\S]*OLD\."gradeLevel" IN \('7', '8', '9', '10'\) THEN/,
  );
  assert.doesNotMatch(
    lifecycle.slice(0, lifecycle.indexOf("correction_id :=")),
    /selectionAcademicTermId|shsClassification|shsClusterCode|shsClusterName|shsCurriculumStatus|shsSourceReference|shsApprovalReference/,
  );
  assert.match(lifecycle, /StudentEnrollmentGradeCorrection_active_context_event_id/);
  assert.match(lifecycle, /child\."sourceStudentSubjectEnrollmentId" = OLD\."id"/);
  assert.match(lifecycle, /correction\."correctedAt" = NEW\."replacedAt"/);
  assert.match(lifecycle, /StudentEnrollmentGradeCorrection_event_is_active/);
  assert.match(lifecycle, /Terminal Student Subject Enrollment lifecycle is immutable/);
  assert.match(lifecycle, /Student Subject Enrollment selection Academic Term is immutable/);
});

test("grade correction has separate immutable event and one-to-one participation models", () => {
  const schema = source("prisma/schema.prisma");
  const eventModel = between(
    schema,
    "model StudentEnrollmentGradeCorrection {",
    "model StudentParticipationCorrection {",
  );
  const childModel = between(
    schema,
    "model StudentParticipationCorrection {",
    "model AcademicYear {",
  );
  const migration = source(migrationPath);

  assert.match(eventModel, /participationCorrections StudentParticipationCorrection\[\]/);
  assert.match(childModel, /sourceStudentSubjectEnrollmentId\s+String\s+@unique/);
  assert.match(childModel, /replacementStudentSubjectEnrollmentId\s+String\s+@unique/);
  assert.match(
    childModel,
    /@@unique\(\[studentEnrollmentGradeCorrectionId, canonicalSubjectPrefix\]/,
  );
  assert.match(migration, /StudentEnrollmentGradeCorrection_assert_immutable/);
  assert.match(
    migration,
    /StudentParticipationCorrection_assert_immutable_trigger[\s\S]*BEFORE UPDATE OR DELETE ON "StudentParticipationCorrection"/,
  );
  assert.doesNotMatch(eventModel, /StudentEnrollmentCorrection\[\]|CurriculumCorrection/);
});

test("grade correction uses a separate exact GUC and advisory namespace", () => {
  const migration = source(migrationPath);
  const contextFunction = between(
    migration,
    'CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_context_id"()',
    'CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_event_is_active"',
  );
  const lockFunction = between(
    migration,
    'CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_lock_transaction"()',
    'CREATE TRIGGER "StudentEnrollmentGradeCorrection_00_lock_transaction_trigger"',
  );
  const domainGuard = between(
    migration,
    'CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_assert_domain_context"()',
    'CREATE TRIGGER "StudentEnrollmentGradeCorrection_01_assert_domain_context_trigger"',
  );

  assert.match(contextFunction, /nemesys\.student_enrollment_grade_correction_id/);
  assert.doesNotMatch(contextFunction, /nemesys\.student_enrollment_correction_id/);
  assert.match(lockFunction, /pg_advisory_xact_lock\(2107, NEW\."sequence"::INTEGER\)/);
  assert.doesNotMatch(lockFunction, /2106/);
  assert.match(domainGuard, /nemesys\.student_enrollment_correction_id/);
  assert.match(domainGuard, /cannot be composed across domains/);
});

test("source and destination participation cardinality, codes, and Terms are exact", () => {
  const mutation = source("services/student-enrollment-grade-correction-mutation.service.ts");
  const validation = between(
    mutation,
    "export function validateRegularJhsGradeCorrection",
    "function sourceCoverage",
  );
  const migration = source(migrationPath);
  const completion = between(
    migration,
    'CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_validate_completion"()',
    'CREATE CONSTRAINT TRIGGER "StudentEnrollmentGradeCorrection_completion_trigger"',
  );

  assert.match(
    mutation,
    /REGULAR_JHS_SUBJECT_PREFIXES = \[\s*"FIL", "ENG", "MATH", "SCI", "AP", "MAPEH", "TLE", "GMRC",\s*\] as const/,
  );
  assert.match(validation, /if \(input\.sourceSubjects\.length\) \{/);
  assert.match(validation, /input\.sourceSubjects\.length !== REGULAR_JHS_SUBJECT_PREFIXES\.length/);
  assert.match(validation, /hasExactValues\(input\.sourceSubjects\.map\(\(\{ subjectCode \}\) => subjectCode\), sourceCodes\)/);
  assert.match(validation, /input\.destinationOfferings\.length !== REGULAR_JHS_SUBJECT_PREFIXES\.length/);
  assert.match(validation, /hasExactValues\(input\.destinationOfferings\.map\(\(\{ subjectCode \}\) => subjectCode\), destinationCodes\)/);
  assert.match(validation, /sourceSubjects\.some\(\(\{ termIds: coveredTerms \}\) => !hasExactValues\(coveredTerms, termIds\)\)/);
  assert.match(validation, /destinationOfferings\.some\(\(offering\) =>\s*!hasExactValues\(offering\.termIds, termIds\)/);
  assert.match(migration, /"sourceParticipationCount" IN \(0, 8\)[\s\S]*"replacementParticipationCount" = 8/);
  assert.match(completion, /replacement_count <> 8[\s\S]*replacement_code_count <> 8/);
  assert.match(completion, /must cover exactly every configured Academic Term|StudentSubjectEnrollmentTerm/);
});

test("source participation is validated against locked Offering provenance", () => {
  const mutation = source("services/student-enrollment-grade-correction-mutation.service.ts");
  const validation = between(
    mutation,
    "export function validateRegularJhsGradeCorrection",
    "function sourceCoverage",
  );
  const repository = source("repositories/student-enrollment-grade-correction.repository.ts");
  const sourceLock = between(
    repository,
    "export async function lockGradeCorrectionSourceEvidence",
    "export async function lockGradeCorrectionDestinationOfferings",
  );
  const migration = source(migrationPath);
  const intent = between(
    migration,
    'CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_assert_intent"()',
    'CREATE TRIGGER "StudentEnrollmentGradeCorrection_zz_assert_intent_trigger"',
  );

  assert.match(validation, /subject\.offering\.academicYearId !== input\.academicYear\.id/);
  assert.match(validation, /subject\.offering\.gradeLevel !== input\.sourceSection\.gradeLevel/);
  assert.match(validation, /subject\.offering\.subjectCode !== subject\.subjectCode/);
  assert.match(validation, /subject\.offering\.subjectDescription !== subject\.subjectDescription/);
  assert.match(validation, /hasExactValues\(subject\.offering\.termIds, subject\.termIds\)/);
  assert.match(sourceLock, /FROM "SubjectOffering" offering[\s\S]*FOR SHARE OF offering/);
  assert.match(sourceLock, /FROM "SubjectOfferingTerm" membership[\s\S]*FOR SHARE OF membership, term/);
  assert.match(intent, /LEFT JOIN "SubjectOffering" offering ON offering\."id" = participation\."subjectOfferingId"/);
  assert.match(intent, /must match exact historical baseline Offering evidence/);
});

test("results block correction and the command cannot mutate results or use DROPPED", () => {
  const mutation = source("services/student-enrollment-grade-correction-mutation.service.ts");
  const repository = source("repositories/student-enrollment-grade-correction.repository.ts");
  const migration = source(migrationPath);
  const evidenceGuard = between(
    migration,
    'CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_reject_evidence_mutation"()',
    'CREATE TRIGGER "StudentEnrollmentGradeCorrection_reject_sse_mutation_trigger"',
  );

  assert.match(mutation, /resultCount: row\.terms\.filter\(\(\{ resultId \}\) => resultId !== null\)\.length/);
  assert.match(mutation, /Attached results block grade-level correction/);
  assert.match(migration, /cannot replace participation with DRAFT or FINALIZED SHS Term Results/);
  assert.match(evidenceGuard, /cannot mutate old Terms, results, Grades, DROPPED lifecycle, or unlisted participation/);
  assert.match(evidenceGuard, /OLD\."status" <> 'ACTIVE' OR NEW\."status" <> 'REPLACED'/);
  assert.doesNotMatch(mutation, /status:\s*"DROPPED"|dropActiveStudentSubjectEnrollment/);
  assert.doesNotMatch(repository, /shsTermResult\.(?:create|update|delete)/);
});

test("service retries serializable transactions and follows the locked capability sequence", () => {
  const service = source("services/student-enrollment-grade-correction.service.ts");
  const mutation = source("services/student-enrollment-grade-correction-mutation.service.ts");
  const command = between(
    mutation,
    "export async function correctStudentEnrollmentGradePlacementInTransaction",
  );

  assert.match(service, /const MAX_TRANSACTION_ATTEMPTS = 3/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /error\.code === "P2034"/);
  assert.match(service, /candidate\.code === "40001" \|\| candidate\.code === "40P01"/);
  assertOrdered(command, [
    "lockStudentForEnrollmentSynchronization(",
    "lockGradeCorrectionEnrollment(",
    "lockGradeCorrectionAcademicYear(",
    "lockGradeCorrectionSections(",
    "lockGradeCorrectionConflicts(",
    "lockGradeCorrectionSourceEvidence(",
    "lockGradeCorrectionDestinationOfferings(",
    "deferGradeCorrectionValidation(",
    "setGradeCorrectionCapability(",
    "createGradeCorrectionIntent(",
    "createGradeCorrectionDestinationSse(",
    "createGradeCorrectionSubjectLink(",
    "replaceGradeCorrectionSourceSse(",
    "updateEnrollment(",
    "synchronizeStudentFromEnrollments(",
    "createAuditLogs(",
    "forceGradeCorrectionValidation(",
  ]);
});

test("placement and grade correction commands do not use the retired generic JHS reconciliation helper", () => {
  const enrollmentService = source("services/enrollment.service.ts");
  const placementMutation = source("services/student-enrollment-correction-mutation.service.ts");
  const gradeMutation = source("services/student-enrollment-grade-correction-mutation.service.ts");

  for (const command of [enrollmentService, placementMutation, gradeMutation]) {
    assert.doesNotMatch(
      command,
      /reconcileApprovedRegularJhsStudentSubjectEnrollments|replaceActiveStudentSubjectEnrollments/,
    );
  }
  assert.match(gradeMutation, /replaceGradeCorrectionSourceSse/);
});

test("destination Subjects are isolated before and during correction, including zero-source events", () => {
  const migration = source(migrationPath);
  const intent = between(
    migration,
    'CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_assert_intent"()',
    'CREATE TRIGGER "StudentEnrollmentGradeCorrection_zz_assert_intent_trigger"',
  );
  const subjectGuard = between(
    migration,
    'CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_guard_subject"()',
    'CREATE TRIGGER "StudentEnrollmentGradeCorrection_guard_subject_trigger"',
  );

  assert.match(intent, /actual_source_count NOT IN \(0, 8\)/);
  assert.match(intent, /StudentEnrollmentGradeCorrection_has_prior_mutation"\('subject', offering\."subjectId"\)/);
  assert.match(intent, /cannot follow destination Subject Offering configuration mutation/);
  assert.match(subjectGuard, /StudentEnrollmentGradeCorrection_subject_is_destination/);
  assert.match(subjectGuard, /Destination Subject in a Student Enrollment Grade Correction cannot be mutated/);
  assert.match(subjectGuard, /StudentEnrollmentGradeCorrection_mark_prior_mutation"\('subject', subject_id\)/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "Subject"/);
});

test("Action and Service independently require STUDENT_CORRECTIONS while same-grade correction remains", () => {
  const action = source("actions/student-enrollment-correction.action.ts");
  const service = source("services/student-enrollment-grade-correction.service.ts");
  const previewAction = between(
    action,
    "export async function getStudentEnrollmentGradeCorrectionPreviewAction",
    "export async function correctStudentEnrollmentGradePlacementAction",
  );
  const gradeAction = between(
    action,
    "export async function correctStudentEnrollmentGradePlacementAction",
  );
  const sameGradeAction = between(
    action,
    "export async function correctStudentEnrollmentPlacementAction",
    "export async function getStudentEnrollmentGradeCorrectionPreviewAction",
  );

  assert.match(previewAction, /requirePermission\(Permissions\.STUDENT_CORRECTIONS\)/);
  assert.match(gradeAction, /requirePermission\(Permissions\.STUDENT_CORRECTIONS\)/);
  assert.equal(
    (service.match(/requirePermission\(Permissions\.STUDENT_CORRECTIONS\)/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(service, /Permissions\.ENROLLMENT|Permissions\.GRADES/);
  assert.match(sameGradeAction, /correctStudentEnrollmentPlacementService/);
  assert.match(sameGradeAction, /Enrollment placement corrected successfully/);
});

test("dialog branches to reviewed grade correction with blockers and confirmation history statement", () => {
  const dialog = source(
    "app/(protected)/dashboard/enrollment/components/correct-enrollment-placement-dialog.tsx",
  );
  const submit = between(dialog, "async function submit()", "const options =");
  const review = between(dialog, "function GradeCorrectionReview(", "function SubjectCoverage(");

  assert.match(dialog, /destination\.gradeLevel !== context\.gradeLevel/);
  assert.match(submit, /if \(isDifferentGrade\)[\s\S]*gradeCorrection\.mutateAsync/);
  assert.match(submit, /const result = await correction\.mutateAsync/);
  assert.match(dialog, /<GradeCorrectionReview[\s\S]*preview=\{preview\}/);
  assert.match(review, /preview\.blockers\.map/);
  assert.match(review, /Historical source subjects/);
  assert.match(review, /Derived destination subjects/);
  assert.match(dialog, /typedConfirmation !== preview\.typedConfirmationPhrase/);
  assert.match(dialog, /The phrase must match exactly/);
  assert.match(dialog, /Old[\s\S]*subject participation, Term memberships, results, and Grades[\s\S]*old grade history/);
  assert.match(dialog, /Grade is not changing/);
});

test("correction history unifies placement and grade events in deterministic order", () => {
  const repository = source("repositories/student-enrollment-correction.repository.ts");
  const gradeHistory = between(
    repository,
    "export function findStudentEnrollmentCorrectionHistory",
    "export function findSameGradePlacementDestinations",
  );
  const service = source("services/student-enrollment-correction.service.ts");
  const contextService = between(
    service,
    "export async function getStudentEnrollmentCorrectionContextService",
    "export async function correctStudentEnrollmentPlacementService",
  );
  const schema = source("schemas/enrollment.schema.ts");
  const historyUi = source(
    "app/(protected)/dashboard/enrollment/components/student-enrollment-correction-history.tsx",
  );

  assert.match(gradeHistory, /FROM "StudentEnrollmentCorrection" correction[\s\S]*UNION ALL[\s\S]*FROM "StudentEnrollmentGradeCorrection" correction/);
  assert.equal((gradeHistory.match(/JOIN "User" actor ON actor\."id" = correction\."correctedById"/g) ?? []).length, 2);
  assert.match(contextService, /Promise\.all\(\[[\s\S]*findStudentEnrollmentCorrectionContext\(enrollmentId, transaction\)[\s\S]*findStudentEnrollmentCorrectionHistory\(enrollmentId, transaction\)/);
  assert.match(contextService, /Prisma\.TransactionIsolationLevel\.RepeatableRead/);
  assert.match(gradeHistory, /'PLACEMENT'::TEXT AS "correctionType"/);
  assert.match(gradeHistory, /'GRADE_LEVEL'::TEXT AS "correctionType"/);
  assert.match(contextService, /sourceParticipationCount: correction\.sourceParticipationCount/);
  assert.match(gradeHistory, /ORDER BY "correctedAt" DESC, "id" DESC/);
  assert.doesNotMatch(repository, /placementCorrections:\s*\{/);
  assert.match(schema, /correctionType: "PLACEMENT" \| "GRADE_LEVEL"/);
  assert.match(historyUi, /Enrollment Correction History/);
  assert.match(historyUi, /correction\.correctionType === "GRADE_LEVEL"/);
  assert.match(historyUi, /historical source participation/);
  assert.match(historyUi, /replacement participation/);
});

test("correction context reads retain the dedicated authorization and serializable action payload", () => {
  const permissions = source("lib/permissions.ts");
  const action = source("actions/student-enrollment-correction.action.ts");
  const service = source("services/student-enrollment-correction.service.ts");
  const contextAction = between(
    action,
    "export async function getStudentEnrollmentCorrectionContextAction",
    "export async function correctStudentEnrollmentPlacementAction",
  );
  const contextService = between(
    service,
    "export async function getStudentEnrollmentCorrectionContextService",
    "export async function correctStudentEnrollmentPlacementService",
  );

  assert.match(
    permissions,
    /\[Permissions\.STUDENT_CORRECTIONS\]: \["SUPER_ADMIN", "REGISTRAR"\]/,
  );
  assert.match(contextAction, /requirePermission\(Permissions\.STUDENT_CORRECTIONS\)/);
  assert.match(contextAction, /z\.string\(\)\.min\(1\)\.safeParse\(enrollmentId\)/);
  assert.match(contextAction, /return getStudentEnrollmentCorrectionContextService\(validatedId\.data\)/);
  assert.match(contextService, /requirePermission\(Permissions\.STUDENT_CORRECTIONS\)/);
  assert.match(contextService, /StudentEnrollmentCorrectionError\("Enrollment not found\."\)/);
  assert.match(contextService, /enrollmentId: enrollment\.id/);
  assert.match(contextService, /destinations,/);
  assert.match(contextService, /history: corrections\.map/);
});

test("preview refreshes after stale mutation errors and renders subject result blockers", () => {
  const dialog = source(
    "app/(protected)/dashboard/enrollment/components/correct-enrollment-placement-dialog.tsx",
  );
  const submit = between(dialog, "async function submit()", "const options =");
  const review = between(dialog, "function GradeCorrectionReview(", "function SubjectCoverage(");
  const subjectCoverage = between(dialog, "function SubjectCoverage(", "function PlacementFact(");
  const schema = source("schemas/enrollment.schema.ts");
  const previewSchema = between(
    schema,
    "export interface StudentEnrollmentGradeCorrectionPreview",
    "// Retained only for the legacy Semester-retirement contract.",
  );

  assert.match(submit, /if \(result\.error\)[\s\S]*toast\.error\(result\.error\)[\s\S]*await previewQuery\.refetch\(\)/);
  assert.match(review, /const hasResultBlockers = preview\.resultBlockers\.length > 0/);
  assert.match(review, /subjects=\{preview\.sourceSubjects\}[\s\S]*resultBlockers=\{preview\.resultBlockers\}/);
  assert.match(review, /subjects=\{preview\.destinationSubjects\}/);
  assert.match(review, /Resolve the subject-level result blockers shown below/);
  assert.match(subjectCoverage, /resultBlockers\.filter\([\s\S]*blocker\.subjectCode === subject\.subjectCode/);
  assert.match(subjectCoverage, /Result blockers/);
  assert.match(subjectCoverage, /subjectResultBlockers\.map/);
  assert.match(previewSchema, /resultBlockers: Array<\{/);
  assert.match(previewSchema, /studentSubjectEnrollmentId: string/);
  assert.match(previewSchema, /resultCount: number/);
});

test("dialog isolates unavailable context and stale preview data from its ready form", () => {
  const dialog = source(
    "app/(protected)/dashboard/enrollment/components/correct-enrollment-placement-dialog.tsx",
  );
  const shell = between(
    dialog,
    "export function CorrectEnrollmentPlacementDialog",
    "function ReadyCorrectEnrollmentPlacementDialog",
  );
  const ready = between(
    dialog,
    "function ReadyCorrectEnrollmentPlacementDialog",
    "type GradeCorrectionPreview",
  );

  assert.match(dialog, /function hasCorrectionDestinations\([\s\S]*value !== null[\s\S]*"destinations" in value && Array\.isArray\(value\.destinations\)/);
  assert.match(shell, /const context = hasCorrectionDestinations\(contextQuery\.data\)[\s\S]*\? contextQuery\.data[\s\S]*: undefined/);
  assert.match(shell, /!open \|\| !context/);
  assert.match(shell, /Loading placement context/);
  assert.match(shell, /Unable to load placement correction context/);
  assert.match(shell, /<ReadyCorrectEnrollmentPlacementDialog[\s\S]*context=\{context\}/);
  assert.match(ready, /previewQuery\.data\?\.destinationSectionId === destinationSectionId/);
  assert.match(ready, /commonInvalid \|\| !previewQuery\.isSuccess \|\| !preview/);
  assert.match(ready, /if \(!destination\) return/);
  assert.doesNotMatch(ready, /context!|destination!/);
});

test("direct SHS destinations are rejected before an empty Offering lock query", () => {
  const mutation = source("services/student-enrollment-grade-correction-mutation.service.ts");
  const command = between(
    mutation,
    "export async function correctStudentEnrollmentGradePlacementInTransaction",
  );
  assertOrdered(command, [
    "getRegularJhsExpectedCodes(destinationSection.gradeLevel)",
    "if (!expectedDestinationCodes.length)",
    "destination must be an active regular JHS Grade 7-10 Section",
    "lockGradeCorrectionDestinationOfferings(",
  ]);
});

test("grade correction invalidates only affected Enrollment, Student, history, preview, participation, and filter keys", () => {
  const hook = source("hooks/enrollment.hook.ts");
  const gradeHook = between(
    hook,
    "export function useCorrectStudentEnrollmentGradePlacement()",
    "export function useTransitionEnrollment()",
  );

  const expectedKeys = [
    '["enrollments"]',
    '["students"]',
    '["student-enrollment-corrections", values.id]',
    '["student-enrollment-grade-correction-preview", values.id]',
    '["student-subject-enrollments", values.id]',
    '["enrollment-filter-options"]',
  ];
  for (const queryKey of expectedKeys) assert.ok(gradeHook.includes(queryKey), `Missing ${queryKey}`);
  assert.equal((gradeHook.match(/invalidateQueries/g) ?? []).length, expectedKeys.length);
  assert.doesNotMatch(
    gradeHook,
    /subject-offerings|curriculum|shs-current-term-progression|shs-term-result|academic-years|academic-terms/i,
  );
});

test("JHS grade correction does not use CurriculumCorrection, SHS workflows, or TermEnrollment", () => {
  const files = [
    "actions/student-enrollment-correction.action.ts",
    "services/student-enrollment-grade-correction.service.ts",
    "services/student-enrollment-grade-correction-mutation.service.ts",
    "repositories/student-enrollment-grade-correction.repository.ts",
    migrationPath,
  ].map(source);
  const application = files.slice(0, 4).join("\n");
  const migration = files[4];

  assert.doesNotMatch(application, /CurriculumCorrection|TermEnrollment/);
  assert.doesNotMatch(
    application,
    /shs-current-term|progressShs|dropActiveStudentSubjectEnrollment|ShsElective|ShsCurriculum/,
  );
  assert.doesNotMatch(migration, /"CurriculumCorrection"|"TermEnrollment"/);
  assert.match(application, /gradeLevel: \{ in: \["7", "8", "9", "10"\]/);
  assert.match(application, /trackStrand: null/);
  assert.match(application, /entryAcademicTermId !== null|entryAcademicTermId: string \| null/);
});
