import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { Prisma } from "../../app/generated/prisma/client";
import { resolveShsTermResultAuthority } from "../../lib/shs-term-result-authority";
import { interpretFinalizedShsTermResult } from "../../lib/shs-term-result-interpretation";
import { ReviseFinalizedShsTermResultSchema } from "../../schemas/student-subject-enrollment.schema";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("21F-D schema and input require immutable finalized result revision evidence", () => {
  const schema = source("prisma/schema.prisma");
  const migration = source("prisma/migrations/20260826000000_phase21f_d_shs_term_result_revision/migration.sql");
  assert.match(schema, /model ShsTermResultRevision \{/);
  assert.match(schema, /@@unique\(\[shsTermResultId, sequence\]\)/);
  assert.match(schema, /predecessorRevisionId String\? @unique/);
  for (const field of ["originalFinalResultSnapshot", "priorAuthoritativeResult", "revisedFinalResult", "reason", "evidenceReference", "revisedById"]) assert.match(schema, new RegExp(field));
  assert.match(migration, /requires an active finalized SHS Term Result/);
  assert.match(migration, /predecessor chain is invalid/);
  assert.match(migration, /SHS Term Result Revisions are immutable/);
  assert.match(migration, /SHS Term Result identity is immutable/);
  const base = { enrollmentId: "e", studentSubjectEnrollmentId: "s", academicTermId: "t", shsTermResultId: "r", expectedLatestRevisionId: null, expectedLatestRevisionSequence: 0, expectedPriorAuthoritativeResult: 85, revisedFinalResult: 88, reason: "Correction", evidenceReference: "Registrar evidence", typedConfirmation: "REVISE SUB TERM RESULT" };
  assert.equal(ReviseFinalizedShsTermResultSchema.safeParse(base).success, true);
  assert.equal(ReviseFinalizedShsTermResultSchema.safeParse({ ...base, reason: " " }).success, false);
  assert.equal(ReviseFinalizedShsTermResultSchema.safeParse({ ...base, revisedFinalResult: 85 }).success, true);
});

test("resolver and interpretation use the latest revision without overwriting original evidence", () => {
  const root = new Prisma.Decimal("85.00");
  const authority = resolveShsTermResultAuthority({ status: "FINALIZED", finalResult: root, revisions: [{ id: "one", sequence: 1, revisedFinalResult: new Prisma.Decimal("75.00"), revisedAt: new Date() }, { id: "two", sequence: 2, revisedFinalResult: new Prisma.Decimal("88.00"), revisedAt: new Date() }] });
  assert.equal(authority.originalFinalResult?.toString(), "85");
  assert.equal(authority.authoritativeFinalResult?.toString(), "88");
  assert.equal(authority.authoritativeSource, "REVISION");
  assert.equal(authority.latestRevisionSequence, 2);
  assert.equal(interpretFinalizedShsTermResult({ status: "FINALIZED", finalResult: root, authoritativeFinalResult: authority.authoritativeFinalResult }, { status: "PUBLISHED", passingThreshold: new Prisma.Decimal("75.00") })?.outcome, "PASSED");
});

test("revision mutation remains GRADES-protected and does not weaken C1 result blocking", () => {
  const action = source("actions/shs-term-result.action.ts");
  const service = source("services/shs-term-result.service.ts");
  const mutation = source("services/shs-term-result-mutation.service.ts");
  const c1 = source("services/shs-student-participation-correction-mutation.service.ts");
  assert.match(action, /reviseFinalizedShsTermResultAction[\s\S]*requirePermission\(Permissions\.GRADES\)/);
  assert.match(service, /reviseFinalizedShsTermResultService[\s\S]*requirePermission\(Permissions\.GRADES\)/);
  assert.match(mutation, /expectedLatestRevisionSequence/);
  assert.match(mutation, /lockShsTermResultParticipationCorrectionState/);
  assert.match(c1, /source\.terms\.some\(\(\{ resultId \}\) => resultId !== null\)/);
});
