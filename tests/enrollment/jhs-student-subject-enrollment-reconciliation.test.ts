import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import {
  deriveApprovedRegularJhsStudentSubjectEnrollments,
  reconcileApprovedRegularJhsStudentSubjectEnrollments,
} from "../../services/jhs-student-subject-enrollment-derivation.service";

class RollbackFixture extends Error {}

async function createSection(
  transaction: Prisma.TransactionClient,
  actorId: string,
  gradeLevel: string,
  trackStrand: string | null = null,
) {
  return transaction.section.create({
    data: {
      gradeLevel,
      trackStrand,
      sectionName: `Phase 19C ${randomUUID().slice(0, 8)}`,
      createdById: actorId,
    },
    select: { id: true, gradeLevel: true, trackStrand: true },
  });
}

async function createFixture(
  transaction: Prisma.TransactionClient,
  gradeLevel = "7",
  trackStrand: string | null = null,
) {
  const [actor, academicYear] = await Promise.all([
    transaction.user.findFirstOrThrow({
      where: { deletedAt: null },
      select: { id: true },
    }),
    transaction.academicYear.findFirstOrThrow({
      where: { label: "2026-2027", status: "ACTIVE" },
      select: { id: true, label: true },
    }),
  ]);
  const [section, student] = await Promise.all([
    createSection(transaction, actor.id, gradeLevel, trackStrand),
    transaction.student.create({
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
    }),
  ]);
  const enrollment = await transaction.enrollment.create({
    data: {
      studentId: student.id,
      sectionId: section.id,
      academicYearId: academicYear.id,
      createdById: actor.id,
    },
    select: { id: true },
  });
  await deriveApprovedRegularJhsStudentSubjectEnrollments(
    {
      enrollmentId: enrollment.id,
      academicYearId: academicYear.id,
      academicYearLabel: academicYear.label,
      gradeLevel: section.gradeLevel,
      trackStrand: section.trackStrand,
      studentLrn: student.lrn,
      actorId: actor.id,
    },
    transaction,
  );

  return { actor, academicYear, enrollment, section, student };
}

async function correctSection(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  nextSection: { id: string; gradeLevel: string; trackStrand: string | null },
  transaction: Prisma.TransactionClient,
  enrollmentStatus: "ACTIVE" | "COMPLETED" | "DROPPED" | "TRANSFERRED" = "ACTIVE",
  actorId = fixture.actor.id,
) {
  await transaction.enrollment.update({
    where: { id: fixture.enrollment.id },
    data: { sectionId: nextSection.id, status: enrollmentStatus },
  });
  return reconcileApprovedRegularJhsStudentSubjectEnrollments(
    {
      enrollmentId: fixture.enrollment.id,
      academicYearId: fixture.academicYear.id,
      academicYearLabel: fixture.academicYear.label,
      enrollmentStatus,
      previousSection: fixture.section,
      nextSection,
      studentLrn: fixture.student.lrn,
      actorId,
    },
    transaction,
  );
}

test("same eligibility-context Section corrections retain active Student Subject Enrollments", async () => {
  try {
    await prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      const previousRows = await transaction.studentSubjectEnrollment.findMany({
        where: { enrollmentId: fixture.enrollment.id },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      const nextSection = await createSection(transaction, fixture.actor.id, "7");
      const result = await correctSection(fixture, nextSection, transaction);
      const currentRows = await transaction.studentSubjectEnrollment.findMany({
        where: { enrollmentId: fixture.enrollment.id, status: "ACTIVE" },
        select: { id: true },
        orderBy: { id: "asc" },
      });

      assert.deepEqual(result, { replaced: [], created: [] });
      assert.deepEqual(currentRows, previousRows);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
});

test("grade corrections replace JHS rows, copy Offering Terms, and preserve history", async () => {
  try {
    await prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction, "7");
      const previousRows = await transaction.studentSubjectEnrollment.findMany({
        where: { enrollmentId: fixture.enrollment.id, status: "ACTIVE" },
        select: { id: true, gradeLevel: true, subjectCode: true, terms: { select: { academicTermId: true } } },
        orderBy: { subjectCode: "asc" },
      });
      const nextSection = await createSection(transaction, fixture.actor.id, "8");
      const result = await correctSection(fixture, nextSection, transaction);
      const [replacedRows, activeRows, offerings, replacementAudits, creationAudits] =
        await Promise.all([
          transaction.studentSubjectEnrollment.findMany({
            where: { enrollmentId: fixture.enrollment.id, status: "REPLACED" },
            select: { id: true, gradeLevel: true, subjectCode: true, replacedAt: true, terms: { select: { academicTermId: true } } },
            orderBy: { subjectCode: "asc" },
          }),
          transaction.studentSubjectEnrollment.findMany({
            where: { enrollmentId: fixture.enrollment.id, status: "ACTIVE" },
            select: { id: true, subjectOfferingId: true, gradeLevel: true, subjectCode: true, terms: { select: { academicTermId: true }, orderBy: { academicTerm: { position: "asc" } } } },
            orderBy: { subjectCode: "asc" },
          }),
          transaction.subjectOffering.findMany({
            where: { academicYearId: fixture.academicYear.id, gradeLevel: "8", deletedAt: null },
            select: { id: true, subjectCode: true, terms: { select: { academicTermId: true }, orderBy: { academicTerm: { position: "asc" } } } },
            orderBy: { subjectCode: "asc" },
          }),
          transaction.auditLog.count({ where: { module: "StudentSubjectEnrollment", action: "UPDATE", recordId: { in: previousRows.map(({ id }) => id) } } }),
          transaction.auditLog.count({ where: { module: "StudentSubjectEnrollment", action: "CREATE", recordId: { in: result.created.map(({ id }) => id) } } }),
        ]);

      assert.equal(result.replaced.length, 8);
      assert.equal(result.created.length, 8);
      assert.deepEqual(replacedRows.map(({ id, gradeLevel, subjectCode, terms }) => ({ id, gradeLevel, subjectCode, terms })), previousRows);
      assert.ok(replacedRows.every((row) => row.replacedAt));
      assert.deepEqual(
        activeRows.map((row) => ({ subjectOfferingId: row.subjectOfferingId, subjectCode: row.subjectCode, terms: row.terms })),
        offerings.map((offering) => ({ subjectOfferingId: offering.id, subjectCode: offering.subjectCode, terms: offering.terms })),
      );
      assert.equal(replacementAudits, 8);
      assert.equal(creationAudits, 8);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
});

test("regular and specialized context transitions reconcile without inferring specialized curriculum", async () => {
  try {
    await prisma.$transaction(async (transaction) => {
      const regularFixture = await createFixture(transaction, "7");
      const specializedSection = await createSection(transaction, regularFixture.actor.id, "7", "STE");
      await correctSection(regularFixture, specializedSection, transaction);
      assert.equal(await transaction.studentSubjectEnrollment.count({ where: { enrollmentId: regularFixture.enrollment.id, status: "ACTIVE" } }), 0);
      assert.equal(await transaction.studentSubjectEnrollment.count({ where: { enrollmentId: regularFixture.enrollment.id, status: "REPLACED" } }), 8);

      const specializedFixture = await createFixture(transaction, "7", "STE");
      const regularSection = await createSection(transaction, specializedFixture.actor.id, "7");
      await correctSection(specializedFixture, regularSection, transaction);
      assert.equal(await transaction.studentSubjectEnrollment.count({ where: { enrollmentId: specializedFixture.enrollment.id, status: "ACTIVE" } }), 8);

      const specializedNextSection = await createSection(transaction, specializedFixture.actor.id, "7", "SPED");
      const result = await correctSection(specializedFixture, specializedNextSection, transaction);
      assert.deepEqual(result, { replaced: [], created: [] });
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
});

test("terminal Enrollment corrections do not reconcile and reconciliation failure rolls back", async () => {
  const before = await Promise.all([
    prisma.enrollment.count(),
    prisma.studentSubjectEnrollment.count(),
    prisma.auditLog.count(),
  ]);

  try {
    await prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      const nextSection = await createSection(transaction, fixture.actor.id, "8");
      const terminalResult = await correctSection(
        fixture,
        nextSection,
        transaction,
        "COMPLETED",
      );
      assert.deepEqual(terminalResult, { replaced: [], created: [] });
      assert.equal(await transaction.studentSubjectEnrollment.count({ where: { enrollmentId: fixture.enrollment.id, status: "ACTIVE" } }), 8);

      await assert.rejects(
        correctSection(fixture, nextSection, transaction, "ACTIVE", randomUUID()),
        /Foreign key constraint/i,
      );
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }

  assert.deepEqual(
    await Promise.all([
      prisma.enrollment.count(),
      prisma.studentSubjectEnrollment.count(),
      prisma.auditLog.count(),
    ]),
    before,
  );
});
