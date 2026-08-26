import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { TransitionEnrollmentSchema } from "../../schemas/enrollment.schema";
import { deriveApprovedRegularJhsStudentSubjectEnrollments } from "../../services/jhs-student-subject-enrollment-derivation.service";
import { transitionEnrollmentInTransaction } from "../../services/enrollment-lifecycle.service";

class RollbackFixture extends Error {}

async function createFixture(transaction: Prisma.TransactionClient) {
  const [actor, academicYear] = await Promise.all([
    transaction.user.findFirstOrThrow({
      where: { deletedAt: null },
      select: { id: true },
    }),
    transaction.academicYear.findFirstOrThrow({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        label: true,
        terms: { select: { id: true }, orderBy: { position: "asc" }, take: 1 },
      },
    }),
  ]);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const [section, student] = await Promise.all([
    transaction.section.create({
      data: {
        gradeLevel: "7",
        sectionName: `Phase 21 ${suffix}`,
        createdById: actor.id,
      },
      select: { id: true, gradeLevel: true },
    }),
    transaction.student.create({
      data: {
        lrn: `P21${suffix}`,
        firstName: "Lifecycle",
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
  await transaction.student.update({
    where: { id: student.id },
    data: { status: "ENROLLED", currentSectionId: section.id },
  });
  await deriveApprovedRegularJhsStudentSubjectEnrollments(
    {
      enrollmentId: enrollment.id,
      academicYearId: academicYear.id,
      academicYearLabel: academicYear.label,
      gradeLevel: section.gradeLevel,
      studentLrn: student.lrn,
      actorId: actor.id,
    },
    transaction,
  );

  return { actor, academicYear, enrollment, section, student };
}

for (const expected of [
  ["COMPLETED", "ENROLLED"],
  ["DROPPED", "DROPPED"],
  ["TRANSFERRED", "TRANSFERRED"],
] as const) {
  test(`ACTIVE -> ${expected[0]} synchronizes the student and preserves child history`, async () => {
    try {
      await prisma.$transaction(async (transaction) => {
        const fixture = await createFixture(transaction);
        const childrenBefore = await transaction.studentSubjectEnrollment.findMany({
          where: { enrollmentId: fixture.enrollment.id },
          select: { id: true, status: true, replacedAt: true },
          orderBy: { id: "asc" },
        });

        await transitionEnrollmentInTransaction(
          fixture.enrollment.id,
          { status: expected[0] },
          fixture.actor.id,
          transaction,
        );

        const [enrollment, student, childrenAfter, audit] = await Promise.all([
          transaction.enrollment.findUniqueOrThrow({
            where: { id: fixture.enrollment.id },
            select: {
              status: true,
              sectionId: true,
              shsTrack: true,
              entryAcademicTermId: true,
            },
          }),
          transaction.student.findUniqueOrThrow({
            where: { id: fixture.student.id },
            select: { status: true, currentSectionId: true },
          }),
          transaction.studentSubjectEnrollment.findMany({
            where: { enrollmentId: fixture.enrollment.id },
            select: { id: true, status: true, replacedAt: true },
            orderBy: { id: "asc" },
          }),
          transaction.auditLog.findFirst({
            where: {
              module: "Enrollment",
              recordId: fixture.enrollment.id,
              description: `Transitioned enrollment from ACTIVE to ${expected[0]}.`,
            },
          }),
        ]);

        assert.equal(enrollment.status, expected[0]);
        assert.equal(enrollment.sectionId, fixture.section.id);
        assert.equal(enrollment.shsTrack, null);
        assert.equal(
          enrollment.entryAcademicTermId,
          null,
        );
        assert.deepEqual(student, {
          status: expected[1],
          currentSectionId: null,
        });
        assert.deepEqual(childrenAfter, childrenBefore);
        assert.ok(audit);
        throw new RollbackFixture();
      });
    } catch (error) {
      if (!(error instanceof RollbackFixture)) throw error;
    }
  });
}

test("terminal and read-only Enrollments reject further lifecycle transitions", async () => {
  try {
    await prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      await transitionEnrollmentInTransaction(
        fixture.enrollment.id,
        { status: "COMPLETED" },
        fixture.actor.id,
        transaction,
      );
      await assert.rejects(
        transitionEnrollmentInTransaction(
          fixture.enrollment.id,
          { status: "DROPPED" },
          fixture.actor.id,
          transaction,
        ),
        /cannot change from COMPLETED to DROPPED/,
      );

      const second = await createFixture(transaction);
      await transaction.academicYear.update({
        where: { id: second.academicYear.id },
        data: { status: "LOCKED" },
      });
      await assert.rejects(
        transitionEnrollmentInTransaction(
          second.enrollment.id,
          { status: "DROPPED" },
          second.actor.id,
          transaction,
        ),
        /read-only/,
      );
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
});

test("a DB-valid Enrollment in another year does not block a terminal transition", async () => {
  try {
    await prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      const startYear = 2200 + Math.floor(Math.random() * 100);
      const otherYear = await transaction.academicYear.create({
        data: {
          label: `${startYear}-${startYear + 1}`,
          startDate: new Date(`${startYear}-06-01T00:00:00.000Z`),
          endDate: new Date(`${startYear + 1}-04-01T00:00:00.000Z`),
          createdById: fixture.actor.id,
        },
      });
      await transaction.enrollment.create({
        data: {
          studentId: fixture.student.id,
          sectionId: fixture.section.id,
          academicYearId: otherYear.id,
          status: "COMPLETED",
          createdById: fixture.actor.id,
        },
      });

      await transitionEnrollmentInTransaction(
        fixture.enrollment.id,
        { status: "DROPPED" },
        fixture.actor.id,
        transaction,
      );
      assert.deepEqual(
        await transaction.student.findUniqueOrThrow({
          where: { id: fixture.student.id },
          select: { status: true, currentSectionId: true },
        }),
        { status: "DROPPED", currentSectionId: null },
      );
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
});

test("audit failure rolls back Enrollment and student lifecycle writes", async () => {
  const before = await Promise.all([
    prisma.enrollment.count(),
    prisma.student.count(),
    prisma.studentSubjectEnrollment.count(),
    prisma.auditLog.count(),
  ]);

  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      await transitionEnrollmentInTransaction(
        fixture.enrollment.id,
        { status: "DROPPED" },
        randomUUID(),
        transaction,
      );
    }),
    /Foreign key constraint/i,
  );

  assert.deepEqual(
    await Promise.all([
      prisma.enrollment.count(),
      prisma.student.count(),
      prisma.studentSubjectEnrollment.count(),
      prisma.auditLog.count(),
    ]),
    before,
  );
});

test("transition schema rejects ACTIVE and unsupported lifecycle values", () => {
  assert.equal(TransitionEnrollmentSchema.safeParse({ status: "ACTIVE" }).success, false);
  assert.equal(TransitionEnrollmentSchema.safeParse({ status: "ARCHIVED" }).success, false);
});
