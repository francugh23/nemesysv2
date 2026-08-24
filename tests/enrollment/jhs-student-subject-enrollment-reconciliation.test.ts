import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { deriveApprovedRegularJhsStudentSubjectEnrollments } from "../../services/jhs-student-subject-enrollment-derivation.service";
import { correctStudentEnrollmentPlacementInTransaction } from "../../services/student-enrollment-correction-mutation.service";

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

async function createSection(
  transaction: Prisma.TransactionClient,
  actorId: string,
  gradeLevel: string,
  trackStrand: string | null = null,
) {
  return transaction.section.create({
    data: { gradeLevel, trackStrand, sectionName: `Phase 19C ${randomUUID().slice(0, 8)}`, createdById: actorId },
    select: { id: true, gradeLevel: true, trackStrand: true },
  });
}

async function seedExistingParticipation(
  transaction: Prisma.TransactionClient,
  run: () => Promise<void>,
) {
  await transaction.$executeRawUnsafe(
    'ALTER TABLE "StudentSubjectEnrollment" DISABLE TRIGGER "StudentEnrollmentCorrection_reject_sse_mutation_trigger"',
  );
  await transaction.$executeRawUnsafe(
    'ALTER TABLE "StudentSubjectEnrollmentTerm" DISABLE TRIGGER "StudentEnrollmentCorrection_reject_sse_term_mutation_trigger"',
  );
  try {
    await run();
  } finally {
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    await transaction.$executeRawUnsafe(
      'ALTER TABLE "StudentSubjectEnrollment" ENABLE TRIGGER "StudentEnrollmentCorrection_reject_sse_mutation_trigger"',
    );
    await transaction.$executeRawUnsafe(
      'ALTER TABLE "StudentSubjectEnrollmentTerm" ENABLE TRIGGER "StudentEnrollmentCorrection_reject_sse_term_mutation_trigger"',
    );
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
  }
}

async function createFixture(
  transaction: Prisma.TransactionClient,
  gradeLevel = "7",
  trackStrand: string | null = null,
  status: "ACTIVE" | "COMPLETED" = "ACTIVE",
) {
  const actor = await transaction.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
  const academicYear = await transaction.academicYear.findFirstOrThrow({
    where: { label: "2026-2027", status: "ACTIVE" },
    select: { id: true, label: true },
  });
  const section = await createSection(transaction, actor.id, gradeLevel, trackStrand);
  const student = await transaction.student.create({
    data: {
      lrn: `P19C${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      firstName: "Reconciliation",
      lastName: "Student",
      gender: "FEMALE",
      barangay: "Test",
      municipality: "Test",
      province: "Test",
      createdById: actor.id,
    },
    select: { id: true, lrn: true },
  });
  const enrollment = await transaction.enrollment.create({
    data: { studentId: student.id, sectionId: section.id, academicYearId: academicYear.id, status, createdById: actor.id },
    select: { id: true },
  });
  if (status === "ACTIVE") {
    await transaction.student.update({ where: { id: student.id }, data: { status: "ENROLLED", currentSectionId: section.id } });
  }
  await seedExistingParticipation(transaction, () =>
    deriveApprovedRegularJhsStudentSubjectEnrollments({
      enrollmentId: enrollment.id,
      academicYearId: academicYear.id,
      academicYearLabel: academicYear.label,
      gradeLevel: section.gradeLevel,
      trackStrand: section.trackStrand,
      studentLrn: student.lrn,
      actorId: actor.id,
    }, transaction).then(() => undefined),
  );
  return { actor, academicYear, enrollment, section, student };
}

function correctSection(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  destinationSectionId: string,
  transaction: Prisma.TransactionClient,
) {
  return correctStudentEnrollmentPlacementInTransaction(
    fixture.enrollment.id,
    {
      sourceSectionId: fixture.section.id,
      destinationSectionId,
      reason: "Verified same-grade administrative placement mistake.",
      evidenceReference: "Phase 19C regression reference",
      confirmed: true,
    },
    fixture.actor.id,
    transaction,
  );
}

test("same-grade regular JHS Section correction retains all Student Subject Enrollment rows", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction);
    const before = await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      include: { terms: true },
      orderBy: { id: "asc" },
    });
    const destination = await createSection(transaction, fixture.actor.id, "7");
    await correctSection(fixture, destination.id, transaction);
    const after = await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      include: { terms: true },
      orderBy: { id: "asc" },
    });
    assert.deepEqual(after, before);
  });
});

test("grade correction is rejected and JHS participation remains unchanged", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction, "7");
    const before = await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      include: { terms: true },
      orderBy: { id: "asc" },
    });
    const destination = await createSection(transaction, fixture.actor.id, "8");
    await assert.rejects(correctSection(fixture, destination.id, transaction), /cannot change the student's grade level/);
    assert.equal((await transaction.enrollment.findUniqueOrThrow({ where: { id: fixture.enrollment.id } })).sectionId, fixture.section.id);
    assert.deepEqual(await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      include: { terms: true },
      orderBy: { id: "asc" },
    }), before);
  });
});

test("same-grade regular and specialized Section corrections never infer or replace participation", async () => {
  await withRollback(async (transaction) => {
    const regular = await createFixture(transaction, "7");
    const regularRows = await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: regular.enrollment.id }, include: { terms: true }, orderBy: { id: "asc" },
    });
    const specializedDestination = await createSection(transaction, regular.actor.id, "7", "STE");
    await correctSection(regular, specializedDestination.id, transaction);
    assert.deepEqual(await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: regular.enrollment.id }, include: { terms: true }, orderBy: { id: "asc" },
    }), regularRows);

    const specialized = await createFixture(transaction, "7", "STE");
    const regularDestination = await createSection(transaction, specialized.actor.id, "7");
    await correctSection(specialized, regularDestination.id, transaction);
    assert.equal(await transaction.studentSubjectEnrollment.count({ where: { enrollmentId: specialized.enrollment.id } }), 0);
  });
});

test("terminal Enrollment placement correction is rejected without participation changes", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction, "7", null, "COMPLETED");
    const destination = await createSection(transaction, fixture.actor.id, "7");
    const before = await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id }, include: { terms: true }, orderBy: { id: "asc" },
    });
    await assert.rejects(correctSection(fixture, destination.id, transaction), /Only an active Enrollment/);
    assert.deepEqual(await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id }, include: { terms: true }, orderBy: { id: "asc" },
    }), before);
  });
});
