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
  for (const title of ["Effective Communication", "Life and Career Skills", "General Mathematics", "General Science", "Philippine History and Society"]) assert.match(tool, new RegExp(title));
  assert.match(tool, /const JHS_SUBJECT_COUNT = 32/);
  assert.match(tool, /return coreSubjects\.map/);
  assert.doesNotMatch(tool, /const electiveSubjects/);
  assert.match(tool, /expected\.Subject = jhsCount \+ coreSubjects\.length/);
  assert.match(tool, /grade11Electives: 0/);
  assert.match(tool, /subjects: JHS_SUBJECT_COUNT \+ coreSubjects\.length/);
  assert.match(tool, /expected\.ShsCurriculumCluster = clusters\.length/);
  assert.match(tool, /"ShsCurriculumReference"/);
  assert.match(tool, /gradeLevel: "11", semester: null/);
  assert.doesNotMatch(tool, /TRUNCATE CASCADE/);
  assert.doesNotMatch(tool, /DISABLE TRIGGER/);
  assert.doesNotMatch(tool, /DROP SCHEMA/);
  assert.doesNotMatch(tool, /migrate reset/);
});

test("Phase 22C removes only unreferenced curated electives from the current baseline", () => {
  const tool = source("scripts/reset-development-baseline.ts");

  assert.match(tool, /--remove-curated-electives/);
  assert.match(tool, /curatedElectiveCodes/);
  assert.match(tool, /confrelid = '\\"Subject\\"'::regclass/);
  assert.match(tool, /Refusing curated elective deletion because dependent references exist/);
  assert.match(tool, /DELETE FROM "Subject" WHERE "id" = ANY/);
  assert.match(tool, /Deleted \$\{deleted\.rowCount\} curated elective Subjects/);
  assert.match(tool, /Curated elective deletion verification failed/);
});
