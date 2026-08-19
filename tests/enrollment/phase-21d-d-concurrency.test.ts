import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import {
  publishShsTermResultInterpretationPolicyInTransaction,
  saveShsTermResultInterpretationPolicyDraftInTransaction,
} from "../../services/shs-term-result-interpretation-policy-mutation.service";

test("concurrent policy creation and publication preserve one immutable policy", {
  skip: process.env.D_RUN_CONCURRENCY !== "1" ? "requires a disposable cloned database" : false,
}, async () => {
  const actor = await prisma.user.findFirstOrThrow({
    where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  const academicYear = await prisma.academicYear.findFirstOrThrow({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  const values = {
    academicYearId: academicYear.id,
    passingThreshold: 75 as const,
    sourceReference: "Concurrent approved policy",
  };

  const creates = await Promise.allSettled([1, 2].map(() => prisma.$transaction(
    (transaction) => saveShsTermResultInterpretationPolicyDraftInTransaction(values, actor.id, transaction),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )));
  assert.ok(creates.some(({ status }) => status === "fulfilled"));
  assert.equal(await prisma.shsTermResultInterpretationPolicy.count({ where: { academicYearId: academicYear.id } }), 1);

  const policy = await prisma.shsTermResultInterpretationPolicy.findUniqueOrThrow({
    where: { academicYearId: academicYear.id },
  });
  const publishes = await Promise.allSettled([1, 2].map(() => prisma.$transaction(
    (transaction) => publishShsTermResultInterpretationPolicyInTransaction({
      academicYearId: academicYear.id,
      policyId: policy.id,
    }, actor.id, transaction),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )));
  assert.equal(publishes.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal((await prisma.shsTermResultInterpretationPolicy.findUniqueOrThrow({
    where: { id: policy.id },
  })).status, "PUBLISHED");
});
