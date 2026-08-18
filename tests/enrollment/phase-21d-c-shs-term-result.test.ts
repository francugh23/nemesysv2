import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import {
  FinalizeShsTermResultSchema,
  SaveShsTermResultDraftSchema,
} from "../../schemas/student-subject-enrollment.schema";
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

async function fixture(transaction: Prisma.TransactionClient) {
  const actor = await transaction.user.findFirstOrThrow({
    where: { role: "SUPER_ADMIN", status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });
  const participation = await transaction.studentSubjectEnrollment.findFirstOrThrow({
    where: { status: "ACTIVE", shsCurriculumStatus: { not: null } },
    select: {
      id: true,
      enrollmentId: true,
      terms: {
        select: {
          academicTermId: true,
          academicTerm: { select: { startDate: true, endDate: true } },
        },
        orderBy: { academicTerm: { position: "asc" } },
      },
    },
  });
  const term = participation.terms[0]!;
  return {
    actor,
    participation,
    term,
    identity: {
      enrollmentId: participation.enrollmentId,
      studentSubjectEnrollmentId: participation.id,
      academicTermId: term.academicTermId,
    },
  };
}

function onDate(date: Date) {
  return () => new Date(`${date.toISOString().slice(0, 10)}T04:00:00.000Z`);
}

test("SHS Term Result schemas enforce nullable drafts and two-decimal 0.00-100.00 values", () => {
  const identity = { enrollmentId: "e", studentSubjectEnrollmentId: "s", academicTermId: "t" };
  assert.equal(SaveShsTermResultDraftSchema.parse({ ...identity, finalResult: null }).finalResult, null);
  assert.equal(SaveShsTermResultDraftSchema.parse({ ...identity, finalResult: 88.25 }).finalResult, 88.25);
  assert.equal(SaveShsTermResultDraftSchema.safeParse({ ...identity, finalResult: -0.01 }).success, false);
  assert.equal(SaveShsTermResultDraftSchema.safeParse({ ...identity, finalResult: 100.01 }).success, false);
  assert.equal(SaveShsTermResultDraftSchema.safeParse({ ...identity, finalResult: 88.125 }).success, false);
  assert.equal(FinalizeShsTermResultSchema.safeParse({ ...identity, finalResult: 90 }).success, false);
});

test("ACTIVE SHS participation supports nullable draft creation and draft update with atomic audits", async () => {
  await withRollback(async (transaction) => {
    const found = await fixture(transaction);
    const created = await saveShsTermResultDraftInTransaction(
      { ...found.identity, finalResult: null },
      found.actor.id,
      transaction,
      onDate(found.term.academicTerm.startDate),
    );
    assert.equal(created.status, "DRAFT");
    assert.equal(created.finalResult, null);
    const updated = await saveShsTermResultDraftInTransaction(
      { ...found.identity, finalResult: 89.75 },
      found.actor.id,
      transaction,
      onDate(found.term.academicTerm.endDate),
    );
    assert.equal(updated.finalResult, 89.75);
    assert.equal(await transaction.shsTermResult.count({
      where: {
        studentSubjectEnrollmentId: found.identity.studentSubjectEnrollmentId,
        academicTermId: found.identity.academicTermId,
      },
    }), 1);
    assert.equal(await transaction.auditLog.count({ where: { module: "ShsTermResult", recordId: created.id } }), 2);
  });
});

test("non-member Terms and cross-Enrollment identities are rejected", async () => {
  await withRollback(async (transaction) => {
    const found = await fixture(transaction);
    await assert.rejects(
      saveShsTermResultDraftInTransaction(
        { ...found.identity, academicTermId: "not-a-member", finalResult: 80 },
        found.actor.id,
        transaction,
        onDate(found.term.academicTerm.startDate),
      ),
      /not an immutable membership/,
    );
    const anotherEnrollment = await transaction.enrollment.findFirstOrThrow({
      where: { id: { not: found.identity.enrollmentId } },
      select: { id: true },
    });
    await assert.rejects(
      saveShsTermResultDraftInTransaction(
        { ...found.identity, enrollmentId: anotherEnrollment.id, finalResult: 80 },
        found.actor.id,
        transaction,
        onDate(found.term.academicTerm.startDate),
      ),
      /does not belong/,
    );
  });
});

test("REPLACED and DROPPED participation cannot receive a result", async () => {
  for (const status of ["REPLACED", "DROPPED"] as const) {
    await withRollback(async (transaction) => {
      const found = await fixture(transaction);
      await transaction.studentSubjectEnrollment.update({
        where: { id: found.participation.id },
        data: status === "REPLACED"
          ? { status, replacedAt: new Date() }
          : { status, replacedAt: null, droppedAt: new Date(), dropReason: "Result eligibility test" },
      });
      await assert.rejects(
        saveShsTermResultDraftInTransaction(
          { ...found.identity, finalResult: 80 },
          found.actor.id,
          transaction,
          onDate(found.term.academicTerm.startDate),
        ),
        /Only active SHS subject participation/,
      );
    });
  }
});

test("finalization requires a result and the target Term end date, including the end date", async () => {
  await withRollback(async (transaction) => {
    const found = await fixture(transaction);
    await saveShsTermResultDraftInTransaction(
      { ...found.identity, finalResult: null },
      found.actor.id,
      transaction,
      onDate(found.term.academicTerm.startDate),
    );
    await assert.rejects(
      finalizeShsTermResultInTransaction(found.identity, found.actor.id, transaction, onDate(found.term.academicTerm.endDate)),
      /numeric final result is required/,
    );
    await saveShsTermResultDraftInTransaction(
      { ...found.identity, finalResult: 91.5 },
      found.actor.id,
      transaction,
      onDate(found.term.academicTerm.startDate),
    );
    const beforeEnd = () => new Date(found.term.academicTerm.endDate.getTime() - 24 * 60 * 60 * 1000);
    await assert.rejects(
      finalizeShsTermResultInTransaction(found.identity, found.actor.id, transaction, beforeEnd),
      /only on or after/,
    );
    const finalized = await finalizeShsTermResultInTransaction(
      found.identity,
      found.actor.id,
      transaction,
      onDate(found.term.academicTerm.endDate),
    );
    assert.equal(finalized.status, "FINALIZED");
    assert.equal(finalized.finalResult, 91.5);
  });
});

test("database uniqueness allows only one result per immutable SSE-Term membership", async () => {
  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const found = await fixture(transaction);
      const data = {
        studentSubjectEnrollmentId: found.participation.id,
        academicTermId: found.term.academicTermId,
        createdById: found.actor.id,
      };
      await transaction.shsTermResult.create({ data });
      await transaction.shsTermResult.create({ data });
    }),
    /Unique constraint|unique constraint/i,
  );
});

test("database blocks every update and deletion of finalized evidence", async () => {
  for (const operation of ["update", "delete"] as const) {
    await assert.rejects(
      prisma.$transaction(async (transaction) => {
        const found = await fixture(transaction);
        await saveShsTermResultDraftInTransaction(
          { ...found.identity, finalResult: 87 },
          found.actor.id,
          transaction,
          onDate(found.term.academicTerm.startDate),
        );
        const finalized = await finalizeShsTermResultInTransaction(
          found.identity,
          found.actor.id,
          transaction,
          onDate(found.term.academicTerm.endDate),
        );
        if (operation === "update") {
          await transaction.shsTermResult.update({ where: { id: finalized.id }, data: { finalResult: 88 } });
        } else {
          await transaction.shsTermResult.delete({ where: { id: finalized.id } });
        }
      }),
      /Finalized SHS Term Results are immutable/,
    );
  }
});

test("result and audit roll back together", async () => {
  const before = await prisma.shsTermResult.count();
  await assert.rejects(prisma.$transaction(async (transaction) => {
    const found = await fixture(transaction);
    await saveShsTermResultDraftInTransaction(
      { ...found.identity, finalResult: 84 },
      found.actor.id,
      transaction,
      onDate(found.term.academicTerm.startDate),
    );
    throw new Error("forced rollback");
  }), /forced rollback/);
  assert.equal(await prisma.shsTermResult.count(), before);
});
