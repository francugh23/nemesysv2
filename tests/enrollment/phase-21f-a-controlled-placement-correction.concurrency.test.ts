import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { correctStudentEnrollmentPlacementInTransaction } from "../../services/student-enrollment-correction-mutation.service";

test("concurrent placement corrections serialize to one valid successor", {
  skip: process.env.F21_A_RUN_CONCURRENCY !== "1" ? "requires a disposable cloned database" : false,
}, async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const actor = await prisma.user.findFirstOrThrow({ where: { deletedAt: null, status: "ACTIVE" }, select: { id: true } });
  const academicYear = await prisma.academicYear.findFirstOrThrow({ where: { status: "ACTIVE" }, select: { id: true } });
  const sections = await Promise.all(["Source", "First", "Second"].map((name) => prisma.section.create({
    data: { gradeLevel: "7", sectionName: `21F-A ${name} ${suffix}`, createdById: actor.id },
    select: { id: true },
  })));
  const student = await prisma.student.create({
    data: { lrn: `P21FAC${suffix}`, firstName: "Concurrent", lastName: "Correction", gender: "FEMALE", barangay: "Test", municipality: "Test", province: "Test", createdById: actor.id },
  });
  const enrollment = await prisma.enrollment.create({
    data: { studentId: student.id, sectionId: sections[0]!.id, academicYearId: academicYear.id, createdById: actor.id },
  });
  await prisma.student.update({ where: { id: student.id }, data: { status: "ENROLLED", currentSectionId: sections[0]!.id } });

  const results = await Promise.allSettled(sections.slice(1).map((section) => prisma.$transaction(
    (transaction) => correctStudentEnrollmentPlacementInTransaction(
      enrollment.id,
      { sourceSectionId: sections[0]!.id, destinationSectionId: section.id, reason: "Concurrent correction test", evidenceReference: "21F-A concurrency", confirmed: true },
      actor.id,
      transaction,
    ),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )));
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
  const [storedEnrollment, storedStudent, corrections] = await Promise.all([
    prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } }),
    prisma.student.findUniqueOrThrow({ where: { id: student.id } }),
    prisma.studentEnrollmentCorrection.findMany({ where: { enrollmentId: enrollment.id } }),
  ]);
  assert.equal(corrections.length, 1);
  assert.equal(storedEnrollment.sectionId, corrections[0]!.destinationSectionId);
  assert.equal(storedStudent.currentSectionId, storedEnrollment.sectionId);

  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT pg_advisory_lock(2106, ${Number(corrections[0]!.sequence)})::TEXT AS locked
    `;
    try {
      const [membership] = await transaction.$queryRaw<Array<{ active: boolean; eventId: string | null }>>`
        SELECT
          "StudentEnrollmentCorrection_has_active_enrollment"(${enrollment.id}) AS active,
          "StudentEnrollmentCorrection_active_transaction_event_id"() AS "eventId"
      `;
      assert.deepEqual(membership, { active: false, eventId: null });
    } finally {
      await transaction.$queryRaw`SELECT pg_advisory_unlock(2106, ${Number(corrections[0]!.sequence)})`;
    }
  });
});
