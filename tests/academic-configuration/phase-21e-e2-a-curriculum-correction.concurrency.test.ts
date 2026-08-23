import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { correctSubjectOfferingInTransaction } from "../../services/curriculum-correction.service";

const enabled = process.env.E2_A_RUN_CONCURRENCY === "1";
const clock = () => new Date();

test("concurrent E2-A corrections produce exactly one successor", { skip: !enabled }, async () => {
  const source = await prisma.subjectOffering.findFirst({
    where: {
      deletedAt: null,
      academicYear: { status: "ACTIVE", curriculumFinalization: { isNot: null } },
      gradeLevel: "11",
      shsContext: { curriculumStatus: "SCHOOL_APPROVED", classification: "CORE" },
      sourceCurriculumCorrection: null,
      terms: { some: { academicTerm: { position: 3 } } },
    },
    select: {
      id: true,
      subjectId: true,
      subjectCode: true,
      createdById: true,
      shsContext: true,
      academicYear: { select: { terms: { select: { id: true, position: true } } } },
    },
  });
  assert.ok(source?.shsContext?.sourceReference);
  const effectiveTerm = source.academicYear.terms.find(({ position }) => position === 2);
  const firstTerm = source.academicYear.terms.find(({ position }) => position === 1);
  assert.ok(effectiveTerm && firstTerm);
  const today = new Date();
  const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
  const tomorrow = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
  await prisma.$executeRawUnsafe('ALTER TABLE "AcademicTerm" DISABLE TRIGGER "AcademicTerm_enforce_draft_year_trigger"');
  try {
    await prisma.academicTerm.update({ where: { id: firstTerm.id }, data: { endDate: yesterday } });
    await prisma.academicTerm.update({ where: { id: effectiveTerm.id }, data: { startDate: tomorrow } });
  } finally {
    await prisma.$executeRawUnsafe('ALTER TABLE "AcademicTerm" ENABLE TRIGGER "AcademicTerm_enforce_draft_year_trigger"');
  }
  const values = {
    sourceOfferingId: source.id,
    effectiveAcademicTermId: effectiveTerm.id,
    reason: "E2-A concurrency correction",
    evidenceReference: "Disposable concurrency database",
    confirmation: source.subjectCode,
    replacement: {
      subjectId: source.subjectId,
      gradeLevel: "11" as const,
      academicTermIds: [effectiveTerm.id],
      shsContext: {
        classification: "CORE" as const,
        sourceReference: source.shsContext.sourceReference,
        approvalReference: "Concurrent correction approval",
      },
    },
  };

  const attempt = () => prisma.$transaction(
    (transaction) => correctSubjectOfferingInTransaction(values, source.createdById, transaction, clock, {
      correctionId: randomUUID(),
      replacementOfferingId: randomUUID(),
    }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  const outcomes = await Promise.allSettled([attempt(), attempt()]);
  assert.equal(outcomes.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(await prisma.curriculumCorrection.count({ where: { sourceOfferingId: source.id } }), 1);
  assert.equal(await prisma.subjectOffering.count({ where: { replacesSubjectOfferingId: source.id, deletedAt: null } }), 1);
});
