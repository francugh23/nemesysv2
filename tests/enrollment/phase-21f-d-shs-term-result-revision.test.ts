import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { resolveShsTermResultAuthority } from "../../lib/shs-term-result-authority";
import {
  finalizeShsTermResultInTransaction,
  getShsTermResultRevisionTypedConfirmationPhrase,
  reviseFinalizedShsTermResultInTransaction,
  saveShsTermResultDraftInTransaction,
} from "../../services/shs-term-result-mutation.service";

class RollbackFixture extends Error {}

async function withRollback(run: (transaction: Prisma.TransactionClient) => Promise<void>) {
  try {
    await prisma.$transaction(async (transaction) => {
      await run(transaction);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
}

async function fixture(transaction: Prisma.TransactionClient) {
  const actor = await transaction.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null }, select: { id: true } });
  const participation = await transaction.studentSubjectEnrollment.findFirstOrThrow({
    where: { status: "ACTIVE", shsCurriculumStatus: { not: null }, terms: { some: { result: null } } },
    select: { id: true, enrollmentId: true, subjectCode: true, terms: { where: { result: null }, select: { academicTermId: true, academicTerm: { select: { name: true, startDate: true, endDate: true } }, }, take: 1 } },
  });
  const term = participation.terms[0]!;
  const identity = { enrollmentId: participation.enrollmentId, studentSubjectEnrollmentId: participation.id, academicTermId: term.academicTermId };
  const clock = () => new Date(`${term.academicTerm.endDate.toISOString().slice(0, 10)}T04:00:00.000Z`);
  await saveShsTermResultDraftInTransaction({ ...identity, finalResult: 85 }, actor.id, transaction, clock);
  const root = await finalizeShsTermResultInTransaction(identity, actor.id, transaction, clock);
  return { actor, participation, term, identity, root };
}

function revisionInput(found: Awaited<ReturnType<typeof fixture>>, revisedFinalResult: number, expectedLatestRevisionId: string | null = null, expectedLatestRevisionSequence = 0, expectedPriorAuthoritativeResult = 85) {
  return {
    ...found.identity,
    shsTermResultId: found.root.id,
    expectedLatestRevisionId,
    expectedLatestRevisionSequence,
    expectedPriorAuthoritativeResult,
    revisedFinalResult,
    reason: "Encoded numeric result was incorrect.",
    evidenceReference: "Reviewed source grade sheet.",
    typedConfirmation: getShsTermResultRevisionTypedConfirmationPhrase(found.participation.subjectCode, found.term.academicTerm.name),
  };
}

test("FINALIZED 85 revisions preserve root evidence and derive latest authority", async () => {
  await withRollback(async (transaction) => {
    const found = await fixture(transaction);
    const first = await reviseFinalizedShsTermResultInTransaction(revisionInput(found, 88), found.actor.id, transaction);
    const second = await reviseFinalizedShsTermResultInTransaction(revisionInput(found, 75, first.id, 1, 88), found.actor.id, transaction);
    const root = await transaction.shsTermResult.findUniqueOrThrow({ where: { id: found.root.id }, include: { revisions: { orderBy: { sequence: "asc" } } } });
    const authority = resolveShsTermResultAuthority(root);
    assert.equal(root.finalResult?.toNumber(), 85);
    assert.equal(root.revisions.length, 2);
    assert.equal(second.sequence, 2);
    assert.equal(authority.authoritativeFinalResult?.toNumber(), 75);
    assert.equal(await transaction.auditLog.count({ where: { module: "ShsTermResultRevision", recordId: { in: [first.id, second.id] } } }), 2);
  });
});

test("revision rejects no-op and stale expected chain", async () => {
  await withRollback(async (transaction) => {
    const found = await fixture(transaction);
    await assert.rejects(reviseFinalizedShsTermResultInTransaction(revisionInput(found, 85), found.actor.id, transaction), /must differ/);
    const first = await reviseFinalizedShsTermResultInTransaction(revisionInput(found, 88), found.actor.id, transaction);
    await assert.rejects(reviseFinalizedShsTermResultInTransaction(revisionInput(found, 75), found.actor.id, transaction), /chain changed/);
    assert.equal(first.sequence, 1);
  });
});

test("database rejects revision update, delete, and forged predecessor chain", async () => {
  for (const operation of ["update", "delete", "forged"] as const) {
    await withRollback(async (transaction) => {
      const found = await fixture(transaction);
      const first = await reviseFinalizedShsTermResultInTransaction(revisionInput(found, 88), found.actor.id, transaction);
      if (operation === "update") await assert.rejects(transaction.shsTermResultRevision.update({ where: { id: first.id }, data: { reason: "forged" } }), /immutable/);
      if (operation === "delete") await assert.rejects(transaction.shsTermResultRevision.delete({ where: { id: first.id } }), /immutable/);
      if (operation === "forged") await assert.rejects(transaction.shsTermResultRevision.create({ data: { shsTermResultId: found.root.id, sequence: 3, predecessorRevisionId: first.id, originalFinalResultSnapshot: 85, priorAuthoritativeResult: 88, revisedFinalResult: 90, reason: "forged", evidenceReference: "forged", revisedById: found.actor.id } }), /predecessor chain/);
    });
  }
});
