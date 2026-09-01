import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

test("Phase 22D bootstrap is development-only, authenticated, confirmed, and provisional", async () => {
  const source = await readFile(path.join(root, "app/api/development/phase-22d/bootstrap/route.ts"), "utf8");
  assert.match(source, /NODE_ENV !== "development"/);
  assert.match(source, /requireRole\("SUPER_ADMIN"\)/);
  assert.match(source, /PHASE_22D_REBUILD_SY_2026_2027/);
  assert.match(source, /assertCleanBaseline\(\)/);
  assert.match(source, /PROVISIONAL_DEPED/g);
  assert.doesNotMatch(source, /promoteShsSubjectOfferingService|finalizeCurriculumService/);
});

test("Phase 22D continuation requires legitimate evidence and exact provisional readiness", async () => {
  const source = await readFile(path.join(root, "app/api/development/phase-22d/approve-and-finalize/route.ts"), "utf8");
  assert.match(source, /NODE_ENV !== "development"/);
  assert.match(source, /requireRole\("SUPER_ADMIN"\)/);
  assert.match(source, /PHASE_22D_APPROVE_AND_FINALIZE_SY_2026_2027/);
  assert.match(source, /approvalReferences/);
  assert.match(source, /demo-bot\|test\|sample/);
  assert.match(source, /offerings\.length !== codes\.length/);
  assert.match(source, /pending \|\| approved !== 8 \|\| policies !== 6/);
  assert.doesNotMatch(source, /finalizeCurriculumService/);
});

test("Phase 22D Work Immersion definition uses the authorized Subject service", async () => {
  const source = await readFile(path.join(root, "app/api/development/phase-22d/work-immersion/route.ts"), "utf8");
  assert.match(source, /NODE_ENV !== "development"/);
  assert.match(source, /requireRole\("SUPER_ADMIN"\)/);
  assert.match(source, /PHASE_22D_CREATE_G12_WORK_IMMERSION/);
  assert.match(source, /SSHS-G12-WORK-IMMERSION/);
  assert.match(source, /createSubjectService/);
  assert.doesNotMatch(source, /subjectOffering\.create|subjectOfferingTerm\.create/);
});

test("Phase 22D finalization requires the authenticated B1-ready state", async () => {
  const source = await readFile(path.join(root, "app/api/development/phase-22d/finalize/route.ts"), "utf8");
  assert.match(source, /NODE_ENV !== "development"/);
  assert.match(source, /requireRole\("SUPER_ADMIN"\)/);
  assert.match(source, /PHASE_22D_FINALIZE_CURRICULUM_2026_2027/);
  assert.match(source, /approved !== 8 \|\| provisional \|\| policies !== 6 \|\| finalizations/);
  assert.match(source, /finalizeCurriculumService/);
});
