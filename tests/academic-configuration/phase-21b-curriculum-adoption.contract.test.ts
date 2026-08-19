import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(relativePath: string) {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

const service = read("services/curriculum-adoption.service.ts");
const eligibility = read("services/curriculum-adoption-eligibility.service.ts");
const repository = read("repositories/curriculum-adoption.repository.ts");
const actions = read("actions/curriculum-adoption.action.ts");
const hook = read("hooks/curriculum-adoption.hook.ts");
const page = read("app/(protected)/dashboard/academic-years/page.tsx");
const manager = read("app/(protected)/dashboard/academic-years/components/academic-year-dialog-manager.tsx");
const dialog = read("app/(protected)/dashboard/academic-years/components/curriculum-adoption-dialog.tsx");

test("Phase 21B actions and services independently enforce Permissions.SUBJECTS", () => {
  assert.equal(actions.match(/requirePermission\(Permissions\.SUBJECTS\)/g)?.length, 3);
  assert.equal(service.match(/requirePermission\(Permissions\.SUBJECTS\)/g)?.length, 3);
  assert.doesNotMatch(actions, /SHS_CURRICULUM_APPROVAL|ACADEMIC_YEARS/);
  assert.doesNotMatch(service, /SHS_CURRICULUM_APPROVAL|ACADEMIC_YEARS/);
});

test("Phase 21B service requires an exhaustive foreign-key-valid bijection", () => {
  assert.match(service, /sourceYear\.terms\.length !== destinationYear\.terms\.length/);
  assert.match(service, /values\.termMappings\.length !== sourceYear\.terms\.length/);
  assert.match(service, /mappedSourceIds\.size !== sourceTermIds\.size/);
  assert.match(service, /mappedDestinationIds\.size !== destinationTermIds\.size/);
  assert.match(service, /!sourceTermIds\.has\(id\)/);
  assert.match(service, /!destinationTermIds\.has\(id\)/);
});

test("Phase 21B preview excludes archived source Offerings and rejects archived dependencies", () => {
  assert.match(service, /if \(offering\.deletedAt\)[\s\S]*rows\.excluded\.push/);
  assert.match(eligibility, /SUBJECT_ARCHIVED/);
  assert.match(eligibility, /SHS_CLUSTER_ARCHIVED/);
  assert.match(eligibility, /SHS_CLUSTER_NOT_SCHOOL_FACING/);
  assert.match(repository, /isSchoolFacing: true/);
  assert.match(service, /SOURCE_OFFERING_ARCHIVED/);
  assert.match(repository, /where: \{ academicYearId \}/);
});

test("Phase 21B preview enforces JHS full-term and SSHS provenance eligibility", () => {
  assert.match(service, /INCOMPLETE_JHS_TERM_APPLICABILITY/);
  assert.match(service, /sourceYear\.terms\.some/);
  assert.match(eligibility, /MISSING_SHS_CONTEXT/);
  assert.match(eligibility, /MISSING_SOURCE_REFERENCE/);
  assert.match(eligibility, /MISSING_SHS_CLUSTER/);
  assert.match(eligibility, /INVALID_SHS_CLUSTER_TRACK/);
});

test("Phase 21B distinguishes active conflicts from allowed archived destination identities", () => {
  assert.match(service, /matchingDestination\.find\(\(\{ deletedAt \}\) => !deletedAt\)/);
  assert.match(service, /ACTIVE_DESTINATION_IDENTITY/);
  assert.match(service, /ARCHIVED_DESTINATION_IDENTITY_ALLOWED/);
  assert.match(repository, /SubjectOffering_active_identity_key|subjectId: source\.subjectId/);
});

test("Phase 21B commit revalidates selected Offerings and prevents foreign or stale selections", () => {
  assert.match(service, /if \(!allSourceIds\.has\(sourceOfferingId\)\)/);
  assert.match(service, /does not belong to the source Academic Year/);
  assert.match(service, /if \(!eligibleById\.has\(sourceOfferingId\)\)/);
  assert.match(service, /stale, invalid, archived, or conflicts with the destination/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(repository, /FOR UPDATE/);
});

test("Phase 21B copies Offering snapshots while reusing the Subject identity", () => {
  assert.match(repository, /subjectId: source\.subjectId/);
  assert.match(repository, /subjectCode: source\.subjectCode/);
  assert.match(repository, /subjectDescription: source\.subjectDescription/);
  assert.doesNotMatch(repository, /transaction\.subject\.create/);
  assert.match(repository, /destinationAcademicTermIds\.map/);
});

test("Phase 21B SSHS copy retains classification, cluster, and source but clears approval", () => {
  assert.match(repository, /classification: source\.shsContext\.classification/);
  assert.match(repository, /clusterId: source\.shsContext\.clusterId/);
  assert.match(repository, /sourceReference: source\.shsContext\.sourceReference/);
  assert.match(repository, /curriculumStatus: "PROVISIONAL_DEPED"/);
  assert.match(repository, /approvalReference: null/);
  assert.match(repository, /approvedById: null/);
  assert.match(repository, /approvedAt: null/);
});

test("Phase 21B audit batch and per-Offering metadata share complete operation provenance", () => {
  assert.match(service, /const operationId = randomUUID\(\)/);
  assert.match(service, /module: "SubjectOfferingAdoption"/);
  assert.match(service, /module: "SubjectOffering"/);
  assert.match(service, /recordId: operationId/);
  assert.match(service, /recordId: destination\.id/);
  assert.match(service, /sourceAcademicYear:/);
  assert.match(service, /destinationAcademicYear:/);
  assert.match(service, /sourceOfferingId/);
  assert.match(service, /destinationOfferingId/);
  assert.match(service, /termMappings: offeringTermMappings/);
  assert.match(service, /sourceShsCurriculum/);
  assert.match(service, /destinationShsCurriculum: source\.shsContext \? "PROVISIONAL_DEPED" : null/);
  assert.match(service, /createAuditLogs\([\s\S]*transaction\)/);
});

test("Phase 21B repository has no Enrollment, student curriculum, Grade, or Assignment writes", () => {
  assert.doesNotMatch(repository, /\.(?:enrollment|studentSubjectEnrollment|grade|subjectAssignment)\.(?:create|createMany|update|updateMany|delete|deleteMany|upsert)/);
  assert.doesNotMatch(service, /\.(?:enrollment|studentSubjectEnrollment|grade|subjectAssignment)\.(?:create|createMany|update|updateMany|delete|deleteMany|upsert)/);
});

test("Phase 21B successful mutation invalidates only adoption and Offering query families", () => {
  const expectedKeys = [
    "curriculum-adoption-preview",
    "subject-offerings",
    "subject-offering-options",
    "subject-offering-filter-options",
    "subjects",
  ];

  for (const key of expectedKeys) assert.match(hook, new RegExp(`queryKey: \\["${key}"\\]`));
  assert.match(hook, /if \("error" in result\) return/);
  assert.equal(hook.match(/invalidateQueries/g)?.length, expectedKeys.length);
});

test("Phase 21B UI exposes adoption only to Super Admins and draft destinations", () => {
  assert.match(page, /hasPermission\([\s\S]*Permissions\.SUBJECTS/);
  assert.match(manager, /academicYear\.status === "DRAFT" && canAdoptCurriculum/);
  assert.match(dialog, /Map every source Term to one unique destination Term\. No mapping is inferred\./);
  assert.match(dialog, /Subjects are\s+reused, and no Enrollment or student records are copied\./);
  assert.match(dialog, /requires destination-year review and approval before student use/);
  assert.match(dialog, /does not carry school approval/);
  assert.match(dialog, /Any stale record or new conflict will roll back the entire operation\./);
  assert.match(dialog, /disabled=\{!eligible\}/);
});
