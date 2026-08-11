import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { deriveApprovedRegularJhsStudentSubjectEnrollments } from "../../services/jhs-student-subject-enrollment-derivation.service";

class RollbackFixture extends Error {}

async function createFixture(
  transaction: Prisma.TransactionClient,
  gradeLevel: string,
  trackStrand: string | null = null,
) {
  const [actor, academicYear] = await Promise.all([
    transaction.user.findFirstOrThrow({
      where: { deletedAt: null },
      select: { id: true },
    }),
    transaction.academicYear.findFirstOrThrow({
      where: { label: "2026-2027", status: "ACTIVE" },
      select: { id: true },
    }),
  ]);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const section = await transaction.section.create({
    data: {
      gradeLevel,
      trackStrand,
      sectionName: `Phase 19B ${suffix}`,
      createdById: actor.id,
    },
    select: { id: true, gradeLevel: true, trackStrand: true },
  });
  const student = await transaction.student.create({
    data: {
      lrn: `P19B${suffix}`,
      firstName: "Derivation",
      lastName: "Student",
      gender: "FEMALE",
      barangay: "Test",
      municipality: "Test",
      province: "Test",
      createdById: actor.id,
    },
    select: { id: true, lrn: true },
  });

  return { actor, academicYear, section, student };
}

function createInput(fixture: Awaited<ReturnType<typeof createFixture>>) {
  return {
    studentId: fixture.student.id,
    sectionId: fixture.section.id,
    academicYearId: fixture.academicYear.id,
  };
}

async function createEnrollmentAndDerive(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  transaction: Prisma.TransactionClient,
) {
  const enrollment = await transaction.enrollment.create({
    data: { ...createInput(fixture), createdById: fixture.actor.id },
  });
  await deriveApprovedRegularJhsStudentSubjectEnrollments(
    {
      enrollmentId: enrollment.id,
      academicYearId: fixture.academicYear.id,
      academicYearLabel: "2026-2027",
      gradeLevel: fixture.section.gradeLevel,
      trackStrand: fixture.section.trackStrand,
      studentLrn: fixture.student.lrn,
      actorId: fixture.actor.id,
    },
    transaction,
  );
  return enrollment;
}

async function getMutableCounts() {
  const [enrollments, studentSubjectEnrollments, auditLogs] = await Promise.all([
    prisma.enrollment.count(),
    prisma.studentSubjectEnrollment.count(),
    prisma.auditLog.count(),
  ]);

  return { enrollments, studentSubjectEnrollments, auditLogs };
}

test("regular JHS Grades 7 through 10 derive the approved Offering matrix and all Terms", async () => {
  try {
    await prisma.$transaction(async (transaction) => {
      for (const gradeLevel of ["7", "8", "9", "10"]) {
        const fixture = await createFixture(transaction, gradeLevel);
        const enrollment = await createEnrollmentAndDerive(fixture, transaction);
        const [studentSubjectEnrollments] = await Promise.all([
          transaction.studentSubjectEnrollment.findMany({
            where: { enrollmentId: enrollment.id, status: "ACTIVE" },
            select: {
              subjectOfferingId: true,
              subjectCode: true,
              subjectDescription: true,
              gradeLevel: true,
              terms: {
                select: { academicTermId: true },
                orderBy: { academicTerm: { position: "asc" } },
              },
            },
            orderBy: { subjectCode: "asc" },
          }),
        ]);
        const offerings = await transaction.subjectOffering.findMany({
          where: {
            academicYearId: fixture.academicYear.id,
            gradeLevel,
            deletedAt: null,
          },
          select: {
            id: true,
            subjectCode: true,
            subjectDescription: true,
            gradeLevel: true,
            terms: {
              select: { academicTermId: true },
              orderBy: { academicTerm: { position: "asc" } },
            },
          },
          orderBy: { subjectCode: "asc" },
        });

        assert.equal(studentSubjectEnrollments.length, 8);
        assert.deepEqual(
          studentSubjectEnrollments.map((item) => ({
            subjectOfferingId: item.subjectOfferingId,
            subjectCode: item.subjectCode,
            subjectDescription: item.subjectDescription,
            gradeLevel: item.gradeLevel,
            termIds: item.terms.map((term) => term.academicTermId),
          })),
          offerings.map((offering) => ({
            subjectOfferingId: offering.id,
            subjectCode: offering.subjectCode,
            subjectDescription: offering.subjectDescription,
            gradeLevel: offering.gradeLevel,
            termIds: offering.terms.map((term) => term.academicTermId),
          })),
        );
        const auditLogCount = await transaction.auditLog.count({
          where: {
            module: "StudentSubjectEnrollment",
            action: "CREATE",
            recordId: {
              in: await transaction.studentSubjectEnrollment
                .findMany({
                  where: { enrollmentId: enrollment.id },
                  select: { id: true },
                })
                .then((items) => items.map((item) => item.id)),
            },
          },
        });
        assert.equal(auditLogCount, 8);
      }

      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
});

test("specialized and unsupported Sections create Enrollment records without subject derivation", async () => {
  try {
    await prisma.$transaction(async (transaction) => {
      for (const [gradeLevel, trackStrand] of [["7", "STE"], ["11", null]] as const) {
        const fixture = await createFixture(transaction, gradeLevel, trackStrand);
        const enrollment = await createEnrollmentAndDerive(fixture, transaction);
        const studentSubjectEnrollmentCount = await transaction.studentSubjectEnrollment.count({
          where: { enrollmentId: enrollment.id },
        });

        assert.equal(studentSubjectEnrollmentCount, 0);
      }

      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
});

test("Enrollment identity and active Student Subject Enrollment uniqueness remain protected", async () => {
  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction, "7");
      await createEnrollmentAndDerive(fixture, transaction);
      await transaction.enrollment.create({
        data: { ...createInput(fixture), createdById: fixture.actor.id },
      });
    }),
    /Unique constraint|unique constraint/i,
  );

  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction, "7");
      const enrollment = await createEnrollmentAndDerive(fixture, transaction);
      const studentSubjectEnrollment =
        await transaction.studentSubjectEnrollment.findFirstOrThrow({
          where: { enrollmentId: enrollment.id },
          select: { subjectOfferingId: true },
        });
      await transaction.studentSubjectEnrollment.create({
        data: {
          enrollmentId: enrollment.id,
          subjectOfferingId: studentSubjectEnrollment.subjectOfferingId,
          subjectCode: "Duplicate",
          subjectDescription: "Duplicate",
          gradeLevel: "7",
          createdById: fixture.actor.id,
        },
      });
    }),
    /Unique constraint|unique constraint/i,
  );
});

test("Enrollment, subject derivation, and audit writes roll back together", async () => {
  const before = await getMutableCounts();

  try {
    await prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction, "7");
      await createEnrollmentAndDerive(fixture, transaction);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }

  assert.deepEqual(await getMutableCounts(), before);
});
