import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { finalizeShsTermResultInTransaction, getShsTermResultRevisionTypedConfirmationPhrase, reviseFinalizedShsTermResultInTransaction, saveShsTermResultDraftInTransaction } from "../../services/shs-term-result-mutation.service";

test("concurrent finalized-result revisions allow one fresh chain append", { skip: process.env.C_RUN_CONCURRENCY !== "1" ? "requires a disposable cloned database" : false }, async () => {
  const actor = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null } });
  const participation = await prisma.studentSubjectEnrollment.findFirstOrThrow({ where: { status: "ACTIVE", shsCurriculumStatus: { not: null }, terms: { some: { result: null } } }, select: { id: true, enrollmentId: true, subjectCode: true, terms: { where: { result: null }, select: { academicTermId: true, academicTerm: { select: { name: true, endDate: true } } }, take: 1 } } });
  const term = participation.terms[0]!;
  const identity = { enrollmentId: participation.enrollmentId, studentSubjectEnrollmentId: participation.id, academicTermId: term.academicTermId };
  const clock = () => new Date(`${term.academicTerm.endDate.toISOString().slice(0, 10)}T04:00:00.000Z`);
  const root = await prisma.$transaction(async (transaction) => {
    await saveShsTermResultDraftInTransaction({ ...identity, finalResult: 85 }, actor.id, transaction, clock);
    return finalizeShsTermResultInTransaction(identity, actor.id, transaction, clock);
  });
  const phrase = getShsTermResultRevisionTypedConfirmationPhrase(participation.subjectCode, term.academicTerm.name);
  const outcomes = await Promise.allSettled([75, 88].map((revisedFinalResult) => prisma.$transaction((transaction) => reviseFinalizedShsTermResultInTransaction({ ...identity, shsTermResultId: root.id, expectedLatestRevisionId: null, expectedLatestRevisionSequence: 0, expectedPriorAuthoritativeResult: 85, revisedFinalResult, reason: "Disposable concurrency test", evidenceReference: "Disposable concurrency test", typedConfirmation: phrase }, actor.id, transaction), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })));
  assert.equal(outcomes.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(await prisma.shsTermResultRevision.count({ where: { shsTermResultId: root.id } }), 1);
});
