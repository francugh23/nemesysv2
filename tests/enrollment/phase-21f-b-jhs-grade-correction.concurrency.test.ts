import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { deriveApprovedRegularJhsStudentSubjectEnrollments } from "../../services/jhs-student-subject-enrollment-derivation.service";
import { correctStudentEnrollmentGradePlacementInTransaction } from "../../services/student-enrollment-grade-correction-mutation.service";

async function createCommittedFixture() {
  const prefix = `P21FB${randomUUID().replaceAll("-", "").slice(0, 12)}`;

  return prisma.$transaction(async (transaction) => {
    const [actor, academicYear] = await Promise.all([
      transaction.user.findFirstOrThrow({
        where: { deletedAt: null, status: "ACTIVE" },
        select: { id: true },
      }),
      transaction.academicYear.findFirstOrThrow({
        where: { status: "ACTIVE" },
        select: { id: true, label: true },
      }),
    ]);
    const [source, grade8Destination, grade9Destination] = await Promise.all(
      [
        ["7", "Source"],
        ["8", "Grade 8"],
        ["9", "Grade 9"],
      ].map(([gradeLevel, name]) => transaction.section.create({
        data: {
          gradeLevel: gradeLevel!,
          sectionName: `${prefix} ${name}`,
          createdById: actor.id,
        },
        select: { id: true, gradeLevel: true },
      })),
    );
    const student = await transaction.student.create({
      data: {
        lrn: prefix,
        firstName: "Concurrent",
        lastName: "Grade Correction",
        gender: "FEMALE",
        barangay: "Test",
        municipality: "Test",
        province: "Test",
        createdById: actor.id,
      },
      select: { id: true, lrn: true },
    });
    const enrollment = await transaction.enrollment.create({
      data: {
        studentId: student.id,
        sectionId: source.id,
        academicYearId: academicYear.id,
        createdById: actor.id,
      },
      select: { id: true },
    });
    await transaction.student.update({
      where: { id: student.id },
      data: { status: "ENROLLED", currentSectionId: source.id },
    });
    const sourceParticipation = await deriveApprovedRegularJhsStudentSubjectEnrollments({
      enrollmentId: enrollment.id,
      academicYearId: academicYear.id,
      academicYearLabel: academicYear.label,
      gradeLevel: source.gradeLevel,
      studentLrn: student.lrn,
      actorId: actor.id,
    }, transaction);
    assert.equal(sourceParticipation.length, 8);

    return { actor, source, destinations: [grade8Destination, grade9Destination], student, enrollment };
  });
}

test("concurrent JHS grade corrections serialize to one complete replacement", {
  skip: process.env.F21_B_RUN_CONCURRENCY !== "1" ? "requires a disposable cloned database" : false,
}, async () => {
  const fixture = await createCommittedFixture();
  const results = await Promise.allSettled(fixture.destinations.map((destination) =>
    prisma.$transaction(
      (transaction) => correctStudentEnrollmentGradePlacementInTransaction(
        fixture.enrollment.id,
        {
          sourceSectionId: fixture.source.id,
          destinationSectionId: destination.id,
          reason: "Concurrent regular JHS grade correction test",
          evidenceReference: "Phase 21F-B concurrency fixture",
          confirmed: true,
          typedConfirmation: `CHANGE GRADE 7 TO GRADE ${destination.gradeLevel}`,
        },
        fixture.actor.id,
        transaction,
      ),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )));

  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);

  const [storedEnrollment, storedStudent, corrections, participation] = await Promise.all([
    prisma.enrollment.findUniqueOrThrow({
      where: { id: fixture.enrollment.id },
      select: { sectionId: true },
    }),
    prisma.student.findUniqueOrThrow({
      where: { id: fixture.student.id },
      select: { currentSectionId: true },
    }),
    prisma.studentEnrollmentGradeCorrection.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      include: { participationCorrections: true },
    }),
    prisma.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      select: { gradeLevel: true, status: true },
    }),
  ]);

  assert.equal(corrections.length, 1);
  const correction = corrections[0]!;
  assert.equal(correction.sourceSectionId, fixture.source.id);
  assert.equal(correction.participationCorrections.length, 8);
  assert.equal(participation.filter(({ gradeLevel, status }) => gradeLevel === "7" && status === "REPLACED").length, 8);

  const winner = fixture.destinations.find(({ id }) => id === correction.destinationSectionId);
  assert.ok(winner);
  assert.equal(participation.filter(({ gradeLevel, status }) =>
    gradeLevel === winner.gradeLevel && status === "ACTIVE").length, 8);
  assert.equal(participation.filter(({ status }) => status === "ACTIVE").length, 8);
  assert.equal(storedEnrollment.sectionId, winner.id);
  assert.equal(storedStudent.currentSectionId, winner.id);

  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT pg_advisory_lock(2107, ${Number(correction.sequence)})::TEXT AS locked
    `;
    try {
      await transaction.$queryRaw`
        SELECT set_config('nemesys.student_enrollment_grade_correction_id', ${correction.id}, true)
      `;
      const [capability] = await transaction.$queryRaw<Array<{
        active: boolean;
        eventActive: boolean;
        eventId: string | null;
      }>>`
        SELECT
          "StudentEnrollmentGradeCorrection_has_active_enrollment"(${fixture.enrollment.id}) AS active,
          "StudentEnrollmentGradeCorrection_event_is_active"(${correction.id}) AS "eventActive",
          "StudentEnrollmentGradeCorrection_active_context_event_id"(${fixture.enrollment.id}) AS "eventId"
      `;
      assert.deepEqual(capability, { active: false, eventActive: false, eventId: null });
    } finally {
      await transaction.$queryRaw`
        SELECT pg_advisory_unlock(2107, ${Number(correction.sequence)})
      `;
    }
  });
});

test("grade correction wins against an unscoped reconciliation-style replacement", {
  skip: process.env.F21_B_RUN_CONCURRENCY !== "1" ? "requires a disposable cloned database" : false,
}, async () => {
  const fixture = await createCommittedFixture();
  const destination = fixture.destinations[0];
  assert.ok(destination);

  const [correctionResult, genericResult] = await Promise.allSettled([
    prisma.$transaction(
      (transaction) => correctStudentEnrollmentGradePlacementInTransaction(
        fixture.enrollment.id,
        {
          sourceSectionId: fixture.source.id,
          destinationSectionId: destination.id,
          reason: "Concurrent correction versus generic reconciliation test",
          evidenceReference: "Phase 21F-B capability race fixture",
          confirmed: true,
          typedConfirmation: "CHANGE GRADE 7 TO GRADE 8",
        },
        fixture.actor.id,
        transaction,
      ),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
    prisma.$transaction(
      (transaction) => transaction.studentSubjectEnrollment.updateMany({
        where: { enrollmentId: fixture.enrollment.id, status: "ACTIVE" },
        data: { status: "REPLACED", replacedAt: new Date() },
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  ]);

  assert.equal(correctionResult.status, "fulfilled");
  assert.equal(genericResult.status, "rejected");

  const [storedEnrollment, storedStudent, corrections, participation] = await Promise.all([
    prisma.enrollment.findUniqueOrThrow({
      where: { id: fixture.enrollment.id },
      select: { sectionId: true },
    }),
    prisma.student.findUniqueOrThrow({
      where: { id: fixture.student.id },
      select: { currentSectionId: true },
    }),
    prisma.studentEnrollmentGradeCorrection.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      include: { participationCorrections: true },
    }),
    prisma.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      select: { id: true, gradeLevel: true, status: true, replacedAt: true },
    }),
  ]);

  assert.equal(corrections.length, 1);
  const correction = corrections[0]!;
  assert.equal(correction.destinationSectionId, destination.id);
  assert.equal(correction.participationCorrections.length, 8);

  const source = participation.filter(({ gradeLevel }) => gradeLevel === "7");
  const replacement = participation.filter(({ gradeLevel }) => gradeLevel === "8");
  assert.equal(source.length, 8);
  assert.ok(source.every(({ status, replacedAt }) =>
    status === "REPLACED" && replacedAt?.getTime() === correction.correctedAt.getTime()));
  assert.deepEqual(
    new Set(source.map(({ id }) => id)),
    new Set(correction.participationCorrections.map(({ sourceStudentSubjectEnrollmentId }) =>
      sourceStudentSubjectEnrollmentId)),
  );
  assert.equal(replacement.length, 8);
  assert.ok(replacement.every(({ status }) => status === "ACTIVE"));
  assert.deepEqual(
    new Set(replacement.map(({ id }) => id)),
    new Set(correction.participationCorrections.map(({ replacementStudentSubjectEnrollmentId }) =>
      replacementStudentSubjectEnrollmentId)),
  );
  assert.equal(participation.length, 16);
  assert.equal(storedEnrollment.sectionId, destination.id);
  assert.equal(storedStudent.currentSectionId, destination.id);
});
