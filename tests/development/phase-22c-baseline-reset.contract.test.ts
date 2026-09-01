import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("Phase 22C reset is an explicitly guarded local development workflow", () => {
  const tool = source("scripts/reset-development-baseline.ts");
  const packageJson = source("package.json");

  assert.match(packageJson, /"reset:development-baseline"/);
  assert.match(tool, /NODE_ENV !== "development"/);
  assert.match(tool, /localhost", "127\.0\.0\.1", "::1/);
  assert.match(tool, /DATABASE_URL must name exactly \$\{SOURCE_DATABASE\}/);
  assert.match(tool, /NEMESYS_RESET_CONFIRM/);
  assert.match(tool, /--super-admin-id/);
  assert.match(tool, /ACTIVE, non-deleted SUPER_ADMIN/);
  assert.match(tool, /docker", \["inspect"/);
  assert.match(tool, /if \(!argumentsValue\.apply\) return/);
});

test("Phase 22C builds a candidate and preserves the original as a rollback database", () => {
  const tool = source("scripts/reset-development-baseline.ts");

  assert.match(tool, /nemesysv2_phase22c_candidate_/);
  assert.match(tool, /nemesysv2_phase22c_rollback_/);
  assert.match(tool, /CREATE DATABASE/);
  assert.match(tool, /pg_dump[\s\S]*--schema-only/);
  assert.match(tool, /PostgreSQL 17 emits a random \\restrict token/);
  assert.match(tool, /INSERT INTO "_prisma_migrations"|insertRows\(candidate, "_prisma_migrations"/);
  assert.match(tool, /renameDatabase\(SOURCE_DATABASE, rollback\)/);
  assert.match(tool, /renameDatabase\(candidate, SOURCE_DATABASE\)/);
  assert.match(tool, /Rollback database does not match the original source snapshot/);
  assert.match(tool, /ROLLBACK_NEMESYSV2_PHASE22C_BASELINE/);
});

test("Phase 22C baseline has only approved reusable definitions and no operational data", () => {
  const tool = source("scripts/reset-development-baseline.ts");

  for (const code of ["ACA-ASSH", "ACA-BE", "ACA-ICT", "ACA-STEM", "TP-ASET", "TP-CBT", "TP-CADT", "TP-HT"]) assert.match(tool, new RegExp(`"${code}"`));
  for (const title of ["Effective Communication / Mabisang Komunikasyon", "Life and Career Skills", "General Mathematics", "General Science", "Pag-aaral ng Kasaysayan at Lipunang Pilipino"]) assert.match(tool, new RegExp(title));
  for (const title of ["Contemporary Literature 1", "Contemporary Literature 2", "Introduction to Organization and Management", "Business 1 - Basic Accounting", "Database Management", "Empowerment Technologies", "Biology 1", "Biology 2", "Driving and Automotive Servicing", "Motorcycle and Small Engine Servicing", "Carpentry", "Technical Drafting", "Visual Graphic Design", "Animation", "Food and Beverage Operation", "Bakery Operations"]) assert.match(tool, new RegExp(title));
  assert.match(tool, /const JHS_SUBJECT_COUNT = 32/);
  assert.match(tool, /const electiveSubjects/);
  assert.match(tool, /return \[\.\.\.coreSubjects, \.\.\.electiveSubjects\]\.map/);
  assert.match(tool, /expected\.Subject = jhsCount \+ coreSubjects\.length \+ electiveSubjects\.length/);
  assert.match(tool, /grade11ElectiveSubjects: electiveSubjects\.length/);
  assert.match(tool, /subjects: JHS_SUBJECT_COUNT \+ coreSubjects\.length \+ electiveSubjects\.length/);
  assert.match(tool, /expected\.ShsCurriculumCluster = clusters\.length/);
  assert.match(tool, /"ShsCurriculumReference"/);
  assert.match(tool, /shsCurriculumReferences: 0/);
  assert.match(tool, /sourceTableFingerprint: hash\(source\.tables\)/);
  assert.match(tool, /Candidate SHS Subject definitions differ from the approved baseline/);
  assert.match(tool, /DEPED_SSHS_CATALOG_URL/);
  assert.match(tool, /gradeLevel: "11", semester: null/);
  assert.doesNotMatch(tool, /TRUNCATE CASCADE/);
  assert.doesNotMatch(tool, /DISABLE TRIGGER/);
  assert.doesNotMatch(tool, /DROP SCHEMA/);
  assert.doesNotMatch(tool, /migrate reset/);
  assert.doesNotMatch(tool, /--remove-curated-electives/);
  assert.doesNotMatch(tool, /TRUNCATE CASCADE/);
});
