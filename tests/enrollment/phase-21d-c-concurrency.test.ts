import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import {
  finalizeShsTermResultInTransaction,
  saveShsTermResultDraftInTransaction,
} from "../../services/shs-term-result-mutation.service";

test("concurrent result creation and finalization preserve one immutable result", {
  skip: process.env.C_RUN_CONCURRENCY !== "1" ? "requires a disposable cloned database" : false,
}, async () => {
  const actor = await prisma.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null } });
  const participation = await prisma.studentSubjectEnrollment.findFirstOrThrow({
    where: { status: "ACTIVE", shsCurriculumStatus: { not: null }, terms: { some: { result: null } } },
    select: { id: true, enrollmentId: true, terms: { where: { result: null }, select: { academicTermId: true, academicTerm: { select: { startDate: true, endDate: true } } }, take: 1 } },
  });
  const term = participation.terms[0]!;
  const identity = { enrollmentId: participation.enrollmentId, studentSubjectEnrollmentId: participation.id, academicTermId: term.academicTermId };
  const startClock = () => new Date(`${term.academicTerm.startDate.toISOString().slice(0, 10)}T04:00:00.000Z`);
  const createResults = await Promise.allSettled([80, 90].map((finalResult) => prisma.$transaction(
    (transaction) => saveShsTermResultDraftInTransaction({ ...identity, finalResult }, actor.id, transaction, startClock),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )));
  assert.equal(createResults.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(await prisma.shsTermResult.count({ where: { studentSubjectEnrollmentId: participation.id, academicTermId: term.academicTermId } }), 1);

  const endClock = () => new Date(`${term.academicTerm.endDate.toISOString().slice(0, 10)}T04:00:00.000Z`);
  const finalizeResults = await Promise.allSettled([1, 2].map(() => prisma.$transaction(
    (transaction) => finalizeShsTermResultInTransaction(identity, actor.id, transaction, endClock),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )));
  assert.equal(finalizeResults.filter(({ status }) => status === "fulfilled").length, 1);
  const result = await prisma.shsTermResult.findUniqueOrThrow({ where: { studentSubjectEnrollmentId_academicTermId: { studentSubjectEnrollmentId: participation.id, academicTermId: term.academicTermId } } });
  assert.equal(result.status, "FINALIZED");
});
