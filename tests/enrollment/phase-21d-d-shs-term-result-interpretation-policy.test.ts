import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import { interpretFinalizedShsTermResult } from "../../lib/shs-term-result-interpretation";
import prisma from "../../lib/prisma";
import {
  PublishShsTermResultInterpretationPolicySchema,
  SaveShsTermResultInterpretationPolicyDraftSchema,
} from "../../schemas/shs-term-result-interpretation-policy.schema";
import {
  publishShsTermResultInterpretationPolicyInTransaction,
  saveShsTermResultInterpretationPolicyDraftInTransaction,
} from "../../services/shs-term-result-interpretation-policy-mutation.service";
import {
  finalizeShsTermResultInTransaction,
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

async function policyFixture(transaction: Prisma.TransactionClient) {
  const actor = await transaction.user.findFirstOrThrow({
    where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  const academicYear = await transaction.academicYear.findFirstOrThrow({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  return { actor, academicYear };
}

test("interpretation policy schemas require the approved threshold, reference, and exact identity", () => {
  const valid = {
    academicYearId: "year",
    passingThreshold: 75,
    sourceReference: "School Board Resolution 2026-01",
  };
  assert.equal(SaveShsTermResultInterpretationPolicyDraftSchema.parse(valid).passingThreshold, 75);
  assert.equal(SaveShsTermResultInterpretationPolicyDraftSchema.safeParse({ ...valid, passingThreshold: 74.99 }).success, false);
  assert.equal(SaveShsTermResultInterpretationPolicyDraftSchema.safeParse({ ...valid, sourceReference: "  " }).success, false);
  assert.equal(PublishShsTermResultInterpretationPolicySchema.safeParse({ academicYearId: "year", policyId: "policy" }).success, true);
});

test("ACTIVE Academic Year supports draft creation, draft editing, publication, and atomic audits", async () => {
  await withRollback(async (transaction) => {
    const { actor, academicYear } = await policyFixture(transaction);
    const created = await saveShsTermResultInterpretationPolicyDraftInTransaction({
      academicYearId: academicYear.id,
      passingThreshold: 75,
      sourceReference: "Initial school approval",
    }, actor.id, transaction);
    assert.equal(created.status, "DRAFT");
    assert.equal(created.passingThreshold, 75);

    const updated = await saveShsTermResultInterpretationPolicyDraftInTransaction({
      academicYearId: academicYear.id,
      passingThreshold: 75,
      sourceReference: "Final school-approved documentary basis",
    }, actor.id, transaction);
    assert.equal(updated.id, created.id);
    assert.equal(updated.sourceReference, "Final school-approved documentary basis");

    const published = await publishShsTermResultInterpretationPolicyInTransaction({
      academicYearId: academicYear.id,
      policyId: created.id,
    }, actor.id, transaction, () => new Date("2026-08-21T00:00:00.000Z"));
    assert.equal(published.status, "PUBLISHED");
    assert.equal(published.publishedById, actor.id);
    assert.equal(await transaction.auditLog.count({
      where: { module: "ShsTermResultInterpretationPolicy", recordId: created.id },
    }), 3);
  });
});

test("policy changes are rejected outside an ACTIVE Academic Year", async () => {
  await withRollback(async (transaction) => {
    const { actor, academicYear } = await policyFixture(transaction);
    await transaction.academicYear.update({
      where: { id: academicYear.id },
      data: { status: "LOCKED" },
    });
    await assert.rejects(
      saveShsTermResultInterpretationPolicyDraftInTransaction({
        academicYearId: academicYear.id,
        passingThreshold: 75,
        sourceReference: "Not allowed while locked",
      }, actor.id, transaction),
      /only while the Academic Year is active/,
    );
  });
});

test("database enforces the approved threshold, nonblank source, ACTIVE year, and one policy per year", async () => {
  await assert.rejects(prisma.$transaction(async (transaction) => {
    const { actor, academicYear } = await policyFixture(transaction);
    await transaction.shsTermResultInterpretationPolicy.create({
      data: { academicYearId: academicYear.id, passingThreshold: 74.99, sourceReference: "Invalid", createdById: actor.id },
    });
  }), /threshold_check|check constraint/i);

  await assert.rejects(prisma.$transaction(async (transaction) => {
    const { actor, academicYear } = await policyFixture(transaction);
    await transaction.shsTermResultInterpretationPolicy.create({
      data: { academicYearId: academicYear.id, passingThreshold: 75, sourceReference: " ", createdById: actor.id },
    });
  }), /source_check|check constraint/i);

  await assert.rejects(prisma.$transaction(async (transaction) => {
    const { actor } = await policyFixture(transaction);
    const draftYear = await transaction.academicYear.findFirstOrThrow({ where: { status: "DRAFT" } });
    await transaction.shsTermResultInterpretationPolicy.create({
      data: { academicYearId: draftYear.id, passingThreshold: 75, sourceReference: "Invalid year state", createdById: actor.id },
    });
  }), /only for an active Academic Year/i);

  await assert.rejects(prisma.$transaction(async (transaction) => {
    const { actor, academicYear } = await policyFixture(transaction);
    const data = { academicYearId: academicYear.id, passingThreshold: 75, sourceReference: "Approved", createdById: actor.id };
    await transaction.shsTermResultInterpretationPolicy.create({ data });
    await transaction.shsTermResultInterpretationPolicy.create({ data });
  }), /Unique constraint|unique constraint/i);
});

test("database blocks update and deletion of a published policy", async () => {
  for (const operation of ["update", "delete"] as const) {
    await assert.rejects(prisma.$transaction(async (transaction) => {
      const { actor, academicYear } = await policyFixture(transaction);
      const draft = await saveShsTermResultInterpretationPolicyDraftInTransaction({
        academicYearId: academicYear.id,
        passingThreshold: 75,
        sourceReference: "Immutable published policy",
      }, actor.id, transaction);
      await publishShsTermResultInterpretationPolicyInTransaction({
        academicYearId: academicYear.id,
        policyId: draft.id,
      }, actor.id, transaction);
      if (operation === "update") {
        await transaction.shsTermResultInterpretationPolicy.update({
          where: { id: draft.id },
          data: { sourceReference: "Changed" },
        });
      } else {
        await transaction.shsTermResultInterpretationPolicy.delete({ where: { id: draft.id } });
      }
    }), /Published SHS Term Result interpretation policies are immutable/);
  }
});

test("database blocks direct DRAFT deletion after the Academic Year is no longer ACTIVE", async () => {
  await assert.rejects(prisma.$transaction(async (transaction) => {
    const { actor, academicYear } = await policyFixture(transaction);
    const draft = await saveShsTermResultInterpretationPolicyDraftInTransaction({
      academicYearId: academicYear.id,
      passingThreshold: 75,
      sourceReference: "Draft retained outside the active year",
    }, actor.id, transaction);
    await transaction.academicYear.update({
      where: { id: academicYear.id },
      data: { status: "LOCKED" },
    });
    await transaction.shsTermResultInterpretationPolicy.delete({ where: { id: draft.id } });
  }), /only for an active Academic Year/i);
});

test("direct DECIMAL comparison derives PASSED and FAILED only for finalized evidence under a published policy", () => {
  const policy = {
    passingThreshold: new Prisma.Decimal("75.00"),
    status: "PUBLISHED" as const,
  };
  assert.equal(interpretFinalizedShsTermResult({ status: "FINALIZED", finalResult: new Prisma.Decimal("74.99") }, policy)?.outcome, "FAILED");
  assert.equal(interpretFinalizedShsTermResult({ status: "FINALIZED", finalResult: new Prisma.Decimal("75.00") }, policy)?.outcome, "PASSED");
  assert.equal(interpretFinalizedShsTermResult({ status: "FINALIZED", finalResult: new Prisma.Decimal("100.00") }, policy)?.outcome, "PASSED");
  assert.equal(interpretFinalizedShsTermResult({ status: "DRAFT", finalResult: new Prisma.Decimal("90.00") }, policy), null);
  assert.equal(interpretFinalizedShsTermResult({ status: "FINALIZED", finalResult: new Prisma.Decimal("90.00") }, null), null);
});

test("publishing retrospectively interprets finalized evidence without modifying the result", async () => {
  await withRollback(async (transaction) => {
    const { actor, academicYear } = await policyFixture(transaction);
    const participation = await transaction.studentSubjectEnrollment.findFirstOrThrow({
      where: {
        status: "ACTIVE",
        shsCurriculumStatus: { not: null },
        enrollment: { academicYearId: academicYear.id },
      },
      select: {
        id: true,
        enrollmentId: true,
        terms: {
          select: { academicTermId: true, academicTerm: { select: { startDate: true, endDate: true } } },
          orderBy: { academicTerm: { position: "asc" } },
          take: 1,
        },
      },
    });
    const term = participation.terms[0]!;
    const identity = {
      enrollmentId: participation.enrollmentId,
      studentSubjectEnrollmentId: participation.id,
      academicTermId: term.academicTermId,
    };
    const endClock = () => new Date(`${term.academicTerm.endDate.toISOString().slice(0, 10)}T04:00:00.000Z`);
    await saveShsTermResultDraftInTransaction({ ...identity, finalResult: 75 }, actor.id, transaction, endClock);
    const finalized = await finalizeShsTermResultInTransaction(identity, actor.id, transaction, endClock);
    const before = await transaction.shsTermResult.findUniqueOrThrow({ where: { id: finalized.id } });

    const draft = await saveShsTermResultInterpretationPolicyDraftInTransaction({
      academicYearId: academicYear.id,
      passingThreshold: 75,
      sourceReference: "Retrospective school approval",
    }, actor.id, transaction);
    const published = await publishShsTermResultInterpretationPolicyInTransaction({
      academicYearId: academicYear.id,
      policyId: draft.id,
    }, actor.id, transaction);
    const after = await transaction.shsTermResult.findUniqueOrThrow({ where: { id: finalized.id } });

    assert.deepEqual(after, before);
    assert.equal(interpretFinalizedShsTermResult(after, {
      passingThreshold: new Prisma.Decimal(published.passingThreshold),
      status: "PUBLISHED",
    })?.outcome, "PASSED");
  });
});

test("policy and audit roll back together", async () => {
  const before = await Promise.all([
    prisma.shsTermResultInterpretationPolicy.count(),
    prisma.auditLog.count({ where: { module: "ShsTermResultInterpretationPolicy" } }),
  ]);
  await assert.rejects(prisma.$transaction(async (transaction) => {
    const { actor, academicYear } = await policyFixture(transaction);
    await saveShsTermResultInterpretationPolicyDraftInTransaction({
      academicYearId: academicYear.id,
      passingThreshold: 75,
      sourceReference: "Rollback test",
    }, actor.id, transaction);
    throw new Error("forced rollback");
  }), /forced rollback/);
  assert.deepEqual(await Promise.all([
    prisma.shsTermResultInterpretationPolicy.count(),
    prisma.auditLog.count({ where: { module: "ShsTermResultInterpretationPolicy" } }),
  ]), before);
});
