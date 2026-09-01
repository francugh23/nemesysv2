import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file: string) => readFile(path.join(root, file), "utf8");

test("Phase 23-A assignment identity is an exact Offering-Term-Section slot", async () => {
  const [schema, migration] = await Promise.all([
    read("prisma/schema.prisma"),
    read("prisma/migrations/20260826042000_phase23a_subject_assignment_offering_term/migration.sql"),
  ]);
  const model = schema.match(/model SubjectAssignment \{[\s\S]*?\n\}/)?.[0];
  assert.ok(model);
  assert.match(model, /subjectOfferingId\s+String[\s\S]*academicTermId\s+String[\s\S]*subjectOfferingTerm SubjectOfferingTerm/);
  assert.doesNotMatch(model, /subjectId|academicYearId/);
  assert.match(migration, /REFERENCES "SubjectOfferingTerm"\("subjectOfferingId", "academicTermId"\)/);
  assert.match(migration, /CREATE UNIQUE INDEX "SubjectAssignment_active_slot_key"[\s\S]*"subjectOfferingId", "academicTermId", "sectionId"[\s\S]*WHERE "deletedAt" IS NULL/);
});

test("Phase 23-A permits operational assignment after Curriculum finalization while validating instructional scope", async () => {
  const [service, repository] = await Promise.all([
    read("services/subject-assignment.service.ts"),
    read("repositories/subject-assignment.repository.ts"),
  ]);
  assert.match(service, /findAssignmentScope\(values\.subjectOfferingId, values\.academicTermId/);
  assert.match(service, /if \(!isAcademicYearWritable\(scope\.subjectOffering\.academicYear\.status\)\)/);
  assert.doesNotMatch(service, /curriculumFinalization/);
  assert.match(service, /Teacher not found or inactive/);
  assert.match(service, /Curriculum Offering and Section grade levels must match/);
  assert.match(service, /SHS Curriculum Offering must be school approved before assignment/);
  assert.match(service, /An active Teacher assignment already exists for this Curriculum Offering Term and Section/);
  assert.match(service, /This Term has started\. Use a controlled reassignment\/correction workflow/);
  assert.match(repository, /data: \{ deletedAt: new Date\(\) \}/);
});
