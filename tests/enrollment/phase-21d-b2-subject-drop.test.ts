import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import {
  createLegacyPolicyFixture,
  makeLegacyActiveCurriculumConfigurable,
} from "../helpers/phase-21e-e1-legacy-fixture";
import {
  DropStudentSubjectEnrollmentSchema,
} from "../../schemas/student-subject-enrollment.schema";
import {
  dropShsStudentSubjectEnrollmentInTransaction,
  progressShsCurrentTermInTransaction,
} from "../../services/student-subject-enrollment-selection.service";

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

function clockFor(term: { startDate: Date }) {
  return () => new Date(term.startDate.getTime() + 12 * 60 * 60 * 1000);
}

async function createDropFixture(transaction: Prisma.TransactionClient) {
  const [actor, academicYear] = await Promise.all([
    transaction.user.findFirstOrThrow({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true },
    }),
    transaction.academicYear.findFirstOrThrow({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        terms: {
          select: { id: true, position: true, startDate: true },
          orderBy: { position: "asc" },
        },
      },
    }),
  ]);
  assert.equal(academicYear.terms.length, 3);
  await makeLegacyActiveCurriculumConfigurable(academicYear.id, transaction, true);
  const offerings = await transaction.subjectOffering.findMany({
    where: {
      academicYearId: academicYear.id,
      gradeLevel: "11",
      deletedAt: null,
      shsContext: { is: { curriculumStatus: "PROVISIONAL_DEPED" } },
    },
    select: {
      id: true,
      subjectCode: true,
      terms: { select: { academicTermId: true } },
      shsContext: {
        select: { classification: true, cluster: { select: { deletedAt: true } } },
      },
    },
  });
  const cores = offerings.filter(({ shsContext }) => shsContext?.classification === "CORE");
  const elective = offerings.find(
    (offering) =>
      offering.shsContext?.classification === "TECHPRO_ELECTIVE" &&
      offering.shsContext.cluster?.deletedAt === null &&
      academicYear.terms.every((term) =>
        offering.terms.some(({ academicTermId }) => academicTermId === term.id),
      ),
  );
  assert.ok(cores.length > 0);
  assert.ok(elective);
  await transaction.subjectOfferingShsContext.updateMany({
    where: { subjectOfferingId: { in: [...cores.map(({ id }) => id), elective.id] } },
    data: {
      curriculumStatus: "SCHOOL_APPROVED",
      approvalReference: `Phase 21D-B2 drop fixture ${randomUUID()}`,
      approvedById: actor.id,
      approvedAt: new Date("2026-08-18T00:00:00.000Z"),
    },
  });

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const [section, student] = await Promise.all([
    transaction.section.create({
      data: { gradeLevel: "11", sectionName: `B2 drop ${suffix}`, createdById: actor.id },
    }),
    transaction.student.create({
      data: {
        lrn: `B2D${suffix}`,
        firstName: "Subject",
        lastName: "Drop",
        gender: "FEMALE",
        barangay: "Test",
        municipality: "Test",
        province: "Test",
        createdById: actor.id,
      },
    }),
  ]);
  const enrollment = await transaction.enrollment.create({
    data: {
      studentId: student.id,
      sectionId: section.id,
      academicYearId: academicYear.id,
      entryAcademicTermId: academicYear.terms[0]!.id,
      shsTrack: "ACADEMIC",
      createdById: actor.id,
    },
  });
  const policy = await createLegacyPolicyFixture(
    {
      academicYearId: academicYear.id,
      academicTermId: academicYear.terms[0]!.id,
      gradeLevel: "11",
      minimumElectives: 1,
      maximumElectives: 3,
      createdById: actor.id,
    },
    transaction,
  );
  await progressShsCurrentTermInTransaction(
    { enrollmentId: enrollment.id, subjectOfferingIds: [elective.id] },
    actor.id,
    transaction,
    clockFor(academicYear.terms[0]!),
  );
  const rows = await transaction.studentSubjectEnrollment.findMany({
    where: { enrollmentId: enrollment.id },
    include: { terms: { orderBy: { academicTerm: { position: "asc" } } } },
  });
  const electiveRow = rows.find(({ subjectOfferingId }) => subjectOfferingId === elective.id)!;
  const coreRow = rows.find(({ shsClassification }) => shsClassification === "CORE")!;
  assert.ok(electiveRow);
  assert.ok(coreRow);
  return { actor, academicYear, enrollment, policy, elective, electiveRow, coreRow };
}

test("drop schema trims a valid reason and rejects blank, oversized, or extra input", () => {
  const base = { enrollmentId: "enrollment", studentSubjectEnrollmentId: "subject" };
  const parsed = DropStudentSubjectEnrollmentSchema.parse({ ...base, reason: "  Schedule conflict  " });
  assert.equal(parsed.reason, "Schedule conflict");
  assert.equal(DropStudentSubjectEnrollmentSchema.safeParse({ ...base, reason: "   " }).success, false);
  assert.equal(DropStudentSubjectEnrollmentSchema.safeParse({ ...base, reason: "x".repeat(501) }).success, false);
  assert.equal(
    DropStudentSubjectEnrollmentSchema.safeParse({ ...base, reason: "Valid", academicTermId: "fake" }).success,
    false,
  );
});

test("dropping an elective records a below-minimum exception and atomic audit metadata", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createDropFixture(transaction);
    const droppedAt = new Date("2026-08-20T03:04:05.000Z");
    const result = await dropShsStudentSubjectEnrollmentInTransaction(
      {
        enrollmentId: fixture.enrollment.id,
        studentSubjectEnrollmentId: fixture.electiveRow.id,
        reason: "Documented program adjustment",
      },
      fixture.actor.id,
      transaction,
      () => droppedAt,
    );
    const audit = await transaction.auditLog.findFirstOrThrow({
      where: {
        module: "StudentSubjectEnrollment",
        recordId: fixture.electiveRow.id,
        action: "UPDATE",
      },
      orderBy: { createdAt: "desc" },
    });
    const metadata = audit.metadata as Record<string, unknown>;

    assert.equal(result.dropped?.status, "DROPPED");
    assert.equal(result.dropped?.droppedAt?.toISOString(), droppedAt.toISOString());
    assert.equal(result.dropped?.dropReason, "Documented program adjustment");
    assert.deepEqual(result.policyException, {
      belowMinimum: true,
      minimumElectives: 1,
      resultingElectiveCount: 0,
    });
    assert.equal(metadata.reason, "Documented program adjustment");
    assert.deepEqual(metadata.policyException, result.policyException);
  });
});

test("drop preserves immutable Core snapshots and every prior/future Term", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createDropFixture(transaction);
    const before = await transaction.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: fixture.coreRow.id },
      select: {
        subjectOfferingId: true,
        subjectCode: true,
        subjectDescription: true,
        gradeLevel: true,
        shsClassification: true,
        shsCurriculumStatus: true,
        shsSourceReference: true,
        shsApprovalReference: true,
        terms: { select: { academicTermId: true }, orderBy: { academicTerm: { position: "asc" } } },
      },
    });
    const result = await dropShsStudentSubjectEnrollmentInTransaction(
      {
        enrollmentId: fixture.enrollment.id,
        studentSubjectEnrollmentId: fixture.coreRow.id,
        reason: "Approved whole-row Core withdrawal",
      },
      fixture.actor.id,
      transaction,
      clockFor(fixture.academicYear.terms[0]!),
    );
    const after = await transaction.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: fixture.coreRow.id },
      select: {
        subjectOfferingId: true,
        subjectCode: true,
        subjectDescription: true,
        gradeLevel: true,
        shsClassification: true,
        shsCurriculumStatus: true,
        shsSourceReference: true,
        shsApprovalReference: true,
        terms: { select: { academicTermId: true }, orderBy: { academicTerm: { position: "asc" } } },
      },
    });

    assert.equal(before.terms.length, 3);
    assert.deepEqual(after, before);
    assert.equal(result.policyException, null);
    assert.equal(result.dropped?.status, "DROPPED");
  });
});

test("a dropped Offering cannot be selected again in the same Term", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createDropFixture(transaction);
    await dropShsStudentSubjectEnrollmentInTransaction(
      {
        enrollmentId: fixture.enrollment.id,
        studentSubjectEnrollmentId: fixture.electiveRow.id,
        reason: "Final elective withdrawal",
      },
      fixture.actor.id,
      transaction,
      clockFor(fixture.academicYear.terms[0]!),
    );
    await assert.rejects(
      progressShsCurrentTermInTransaction(
        { enrollmentId: fixture.enrollment.id, subjectOfferingIds: [fixture.elective.id] },
        fixture.actor.id,
        transaction,
        clockFor(fixture.academicYear.terms[0]!),
      ),
      /dropped Offering cannot be selected again/,
    );
  });
});

test("drop rejects participation that does not cover the server current Term", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createDropFixture(transaction);
    await assert.rejects(
      dropShsStudentSubjectEnrollmentInTransaction(
        {
          enrollmentId: fixture.enrollment.id,
          studentSubjectEnrollmentId: fixture.electiveRow.id,
          reason: "Attempt outside its Term",
        },
        fixture.actor.id,
        transaction,
        clockFor(fixture.academicYear.terms[1]!),
      ),
      /covering the current Academic Term/,
    );
    assert.equal(
      (await transaction.studentSubjectEnrollment.findUniqueOrThrow({
        where: { id: fixture.electiveRow.id },
      })).status,
      "ACTIVE",
    );
  });
});

test("a DROPPED row is terminal and its reason, timestamp, and status are immutable", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createDropFixture(transaction);
    await dropShsStudentSubjectEnrollmentInTransaction(
      {
        enrollmentId: fixture.enrollment.id,
        studentSubjectEnrollmentId: fixture.electiveRow.id,
        reason: "Immutable documented reason",
      },
      fixture.actor.id,
      transaction,
      clockFor(fixture.academicYear.terms[0]!),
    );
    await assert.rejects(
      transaction.studentSubjectEnrollment.update({
        where: { id: fixture.electiveRow.id },
        data: { status: "ACTIVE", droppedAt: null, dropReason: null },
      }),
      /Terminal Student Subject Enrollment lifecycle is immutable/,
    );
  });
});
