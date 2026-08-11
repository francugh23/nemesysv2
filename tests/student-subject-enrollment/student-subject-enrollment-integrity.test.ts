import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { findStudentSubjectEnrollments } from "../../repositories/student-subject-enrollment.repository";

class RollbackFixture extends Error {}

async function createFixture(transaction: Prisma.TransactionClient) {
  const [user, academicYear, offering] = await Promise.all([
    transaction.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } }),
    transaction.academicYear.findUniqueOrThrow({
      where: { id: "academic-year-2026-2027" },
      select: { id: true },
    }),
    transaction.subjectOffering.findFirstOrThrow({
      where: {
        academicYearId: "academic-year-2026-2027",
        gradeLevel: "7",
        deletedAt: null,
      },
      select: {
        id: true,
        subjectId: true,
        gradeLevel: true,
        subjectCode: true,
        subjectDescription: true,
        terms: { select: { academicTermId: true } },
      },
    }),
  ]);
  const suffix = randomUUID();
  const section = await transaction.section.create({
    data: {
      gradeLevel: "7",
      sectionName: `Phase 19A ${suffix}`,
      createdById: user.id,
    },
    select: { id: true },
  });
  const student = await transaction.student.create({
    data: {
      lrn: `P19A${suffix.replaceAll("-", "").slice(0, 12)}`,
      firstName: "Foundation",
      lastName: "Student",
      gender: "FEMALE",
      barangay: "Test",
      municipality: "Test",
      province: "Test",
      createdById: user.id,
    },
    select: { id: true },
  });
  const enrollment = await transaction.enrollment.create({
    data: {
      studentId: student.id,
      sectionId: section.id,
      academicYearId: academicYear.id,
      createdById: user.id,
    },
    select: { id: true },
  });

  return { user, enrollment, offering };
}

function createStudentSubjectEnrollment(
  fixture: Awaited<ReturnType<typeof createFixture>>,
) {
  return {
    enrollmentId: fixture.enrollment.id,
    subjectOfferingId: fixture.offering.id,
    subjectCode: fixture.offering.subjectCode,
    subjectDescription: fixture.offering.subjectDescription,
    gradeLevel: fixture.offering.gradeLevel,
    createdById: fixture.user.id,
  };
}

async function getDomainCounts() {
  const [enrollments, offerings, subjects, terms, assignments, grades] = await Promise.all([
    prisma.enrollment.count(),
    prisma.subjectOffering.count(),
    prisma.subject.count(),
    prisma.academicTerm.count(),
    prisma.subjectAssignment.count(),
    prisma.grade.count(),
  ]);

  return { enrollments, offerings, subjects, terms, assignments, grades };
}

test("Student Subject Enrollment reads preserve snapshots, exact Offering Terms, and existing domain records", async () => {
  const before = await getDomainCounts();
  let studentSubjectEnrollments: Awaited<
    ReturnType<typeof findStudentSubjectEnrollments>
  > = [];

  try {
    await prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      const studentSubjectEnrollment = await transaction.studentSubjectEnrollment.create({
        data: {
          ...createStudentSubjectEnrollment(fixture),
          terms: {
            create: fixture.offering.terms.map(({ academicTermId }) => ({ academicTermId })),
          },
        },
      });

      studentSubjectEnrollments = await findStudentSubjectEnrollments(
        { enrollmentId: fixture.enrollment.id, status: "ACTIVE" },
        transaction,
      );

      assert.equal(studentSubjectEnrollments.length, 1);
      assert.equal(studentSubjectEnrollments[0]?.id, studentSubjectEnrollment.id);
      assert.equal(studentSubjectEnrollments[0]?.subjectCode, fixture.offering.subjectCode);
      assert.equal(studentSubjectEnrollments[0]?.terms.length, 3);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }

  assert.deepEqual(await getDomainCounts(), before);
});

test("Student Subject Enrollment migration prevents duplicate active Enrollment and Offering rows", async () => {
  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      const data = createStudentSubjectEnrollment(fixture);
      await transaction.studentSubjectEnrollment.create({ data });
      await transaction.studentSubjectEnrollment.create({ data });
    }),
    /Unique constraint|unique constraint/i,
  );
});

test("Student Subject Enrollment reads expose active rows and immutable replacement history", async () => {
  try {
    await prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      const replaced = await transaction.studentSubjectEnrollment.create({
        data: {
          ...createStudentSubjectEnrollment(fixture),
          status: "REPLACED",
          replacedAt: new Date(),
          terms: {
            create: fixture.offering.terms.map(({ academicTermId }) => ({ academicTermId })),
          },
        },
      });
      const active = await transaction.studentSubjectEnrollment.create({
        data: {
          ...createStudentSubjectEnrollment(fixture),
          terms: {
            create: fixture.offering.terms.map(({ academicTermId }) => ({ academicTermId })),
          },
        },
      });

      const rows = await findStudentSubjectEnrollments(
        { enrollmentId: fixture.enrollment.id },
        transaction,
      );
      const activeRows = await findStudentSubjectEnrollments(
        { enrollmentId: fixture.enrollment.id, status: "ACTIVE" },
        transaction,
      );
      assert.deepEqual(new Set(rows.map((row) => row.status)), new Set(["REPLACED", "ACTIVE"]));
      assert.deepEqual(new Set(rows.map((row) => row.id)), new Set([replaced.id, active.id]));
      assert.ok(rows.every((row) => row.terms.length === fixture.offering.terms.length));
      assert.ok(
        rows.every((row) =>
          row.terms.every(
            (term, index) =>
              term.academicTerm.position === index + 1 && term.academicTerm.name,
          ),
        ),
      );
      assert.deepEqual(activeRows.map((row) => row.id), [active.id]);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
});

test("Student Subject Enrollment migration enforces Offering and Term applicability", async () => {
  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      const alternateYear = await transaction.academicYear.create({
        data: {
          label: "2030-2031",
          startDate: new Date("2030-06-01T00:00:00.000Z"),
          endDate: new Date("2031-03-31T00:00:00.000Z"),
          createdById: fixture.user.id,
        },
        select: { id: true },
      });
      const alternateOffering = await transaction.subjectOffering.create({
        data: {
          subjectId: fixture.offering.subjectId,
          academicYearId: alternateYear.id,
          gradeLevel: fixture.offering.gradeLevel,
          subjectCode: fixture.offering.subjectCode,
          subjectDescription: fixture.offering.subjectDescription,
          createdById: fixture.user.id,
        },
        select: { id: true },
      });

      await transaction.studentSubjectEnrollment.create({
        data: {
          ...createStudentSubjectEnrollment(fixture),
          subjectOfferingId: alternateOffering.id,
        },
      });
    }),
    /Enrollment Academic Year/i,
  );

  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      const studentSubjectEnrollment = await transaction.studentSubjectEnrollment.create({
        data: createStudentSubjectEnrollment(fixture),
      });
      const alternateYear = await transaction.academicYear.create({
        data: {
          label: "2030-2031",
          startDate: new Date("2030-06-01T00:00:00.000Z"),
          endDate: new Date("2031-03-31T00:00:00.000Z"),
          createdById: fixture.user.id,
        },
      });
      const alternateTerm = await transaction.academicTerm.create({
        data: {
          academicYearId: alternateYear.id,
          name: "Term 1",
          position: 1,
          startDate: new Date("2030-06-01T00:00:00.000Z"),
          endDate: new Date("2030-09-01T00:00:00.000Z"),
          createdById: fixture.user.id,
        },
      });

      await transaction.studentSubjectEnrollmentTerm.create({
        data: {
          studentSubjectEnrollmentId: studentSubjectEnrollment.id,
          academicTermId: alternateTerm.id,
        },
      });
    }),
    /source Offering and Enrollment Academic Year/i,
  );
});

test("Student Subject Enrollment snapshots and history cannot be changed or hard-deleted", async () => {
  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      const studentSubjectEnrollment = await transaction.studentSubjectEnrollment.create({
        data: createStudentSubjectEnrollment(fixture),
      });

      await transaction.studentSubjectEnrollment.update({
        where: { id: studentSubjectEnrollment.id },
        data: { subjectCode: "CHANGED" },
      });
    }),
    /source and snapshots are immutable/i,
  );

  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      const studentSubjectEnrollment = await transaction.studentSubjectEnrollment.create({
        data: createStudentSubjectEnrollment(fixture),
      });

      await transaction.studentSubjectEnrollment.delete({
        where: { id: studentSubjectEnrollment.id },
      });
    }),
    /cannot be hard-deleted/i,
  );
});
