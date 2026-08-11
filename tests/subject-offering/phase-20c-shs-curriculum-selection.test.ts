import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { ShsStudentCurriculumSelectionSchema } from "../../schemas/student-subject-enrollment.schema";
import { deriveApprovedRegularJhsStudentSubjectEnrollments } from "../../services/jhs-student-subject-enrollment-derivation.service";
import { selectShsStudentCurriculumInTransaction } from "../../services/student-subject-enrollment-selection.service";

class RollbackFixture extends Error {}

async function withRollback(run: (tx: Prisma.TransactionClient) => Promise<void>) {
  try {
    await prisma.$transaction(async (tx) => {
      await run(tx);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
}

async function createEnrollmentFixture(tx: Prisma.TransactionClient, gradeLevel: string) {
  const [actor, academicYear] = await Promise.all([
    tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } }),
    tx.academicYear.findFirstOrThrow({ where: { status: "ACTIVE" }, select: { id: true, label: true } }),
  ]);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const section = await tx.section.create({
    data: { gradeLevel, sectionName: `P20C ${suffix}`, createdById: actor.id },
  });
  const student = await tx.student.create({
    data: {
      lrn: `P20C${suffix}`,
      firstName: "Phase",
      lastName: "TwentyC",
      gender: "FEMALE",
      barangay: "Test",
      municipality: "Test",
      province: "Test",
      createdById: actor.id,
    },
  });
  const enrollment = await tx.enrollment.create({
    data: { studentId: student.id, sectionId: section.id, academicYearId: academicYear.id, createdById: actor.id },
  });
  return { actor, academicYear, enrollment, student };
}

async function getProvisionalOfferings(tx: Prisma.TransactionClient, academicYearId: string, gradeLevel: string, count = 1) {
  const offerings = await tx.subjectOffering.findMany({
    where: {
      academicYearId,
      gradeLevel,
      deletedAt: null,
      shsContext: { is: { curriculumStatus: "PROVISIONAL_DEPED" } },
    },
    select: {
      id: true,
      terms: {
        select: { academicTermId: true },
        orderBy: { academicTerm: { position: "asc" } },
      },
    },
    orderBy: { id: "asc" },
    take: count,
  });
  assert.equal(offerings.length, count);
  return offerings;
}

async function approveOfferings(tx: Prisma.TransactionClient, offeringIds: string[], actorId: string) {
  await tx.subjectOfferingShsContext.updateMany({
    where: { subjectOfferingId: { in: offeringIds } },
    data: {
      curriculumStatus: "SCHOOL_APPROVED",
      approvalReference: "Board 20C",
      approvedById: actorId,
      approvedAt: new Date(),
    },
  });
}

test("Phase 20C selection schema requires unique Offerings and nonempty unique Academic Terms", () => {
  const selection = { subjectOfferingId: "offering-1", academicTermIds: ["term-1"] };
  assert.equal(ShsStudentCurriculumSelectionSchema.safeParse({ enrollmentId: "enrollment-1", selections: [selection] }).success, true);
  assert.equal(ShsStudentCurriculumSelectionSchema.safeParse({ enrollmentId: "enrollment-1", selections: [{ ...selection, academicTermIds: [] }] }).success, false);
  assert.equal(ShsStudentCurriculumSelectionSchema.safeParse({ enrollmentId: "enrollment-1", selections: [{ ...selection, academicTermIds: ["term-1", "term-1"] }] }).success, false);
  assert.equal(ShsStudentCurriculumSelectionSchema.safeParse({ enrollmentId: "enrollment-1", selections: [selection, selection] }).success, false);
});

test("Phase 20C persists an exact single-Term selection and retains the identical active snapshot", async () => {
  await withRollback(async (tx) => {
    const fixture = await createEnrollmentFixture(tx, "11");
    const [offering] = await getProvisionalOfferings(tx, fixture.academicYear.id, "11");
    await approveOfferings(tx, [offering.id], fixture.actor.id);
    const values = {
      enrollmentId: fixture.enrollment.id,
      selections: [{ subjectOfferingId: offering.id, academicTermIds: [offering.terms[0].academicTermId] }],
    };

    assert.deepEqual(await selectShsStudentCurriculumInTransaction(values, fixture.actor.id, tx), { created: 1, replaced: 0 });
    const first = await tx.studentSubjectEnrollment.findFirstOrThrow({
      where: { enrollmentId: fixture.enrollment.id, status: "ACTIVE" },
      include: { terms: true },
    });
    assert.deepEqual(first.terms.map(({ academicTermId }) => academicTermId), [offering.terms[0].academicTermId]);

    assert.deepEqual(await selectShsStudentCurriculumInTransaction(values, fixture.actor.id, tx), { created: 0, replaced: 0 });
    const retained = await tx.studentSubjectEnrollment.findMany({ where: { enrollmentId: fixture.enrollment.id } });
    assert.equal(retained.length, 1);
    assert.equal(retained[0].id, first.id);
    assert.equal(retained[0].status, "ACTIVE");
  });
});

test("Phase 20C persists exact multi-Term selections for multiple Offerings", async () => {
  await withRollback(async (tx) => {
    const fixture = await createEnrollmentFixture(tx, "11");
    const offerings = await getProvisionalOfferings(tx, fixture.academicYear.id, "11", 2);
    await approveOfferings(tx, offerings.map(({ id }) => id), fixture.actor.id);
    const selections = offerings.map((offering, index) => ({
      subjectOfferingId: offering.id,
      academicTermIds: offering.terms.slice(0, index + 2).map(({ academicTermId }) => academicTermId),
    }));

    assert.deepEqual(await selectShsStudentCurriculumInTransaction({ enrollmentId: fixture.enrollment.id, selections }, fixture.actor.id, tx), { created: 2, replaced: 0 });
    const rows = await tx.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id, status: "ACTIVE" },
      select: { subjectOfferingId: true, terms: { select: { academicTermId: true } } },
      orderBy: { subjectOfferingId: "asc" },
    });
    assert.deepEqual(
      rows.map((row) => ({ subjectOfferingId: row.subjectOfferingId, academicTermIds: row.terms.map(({ academicTermId }) => academicTermId).sort() })),
      selections.map((selection) => ({ ...selection, academicTermIds: [...selection.academicTermIds].sort() })).sort((a, b) => a.subjectOfferingId.localeCompare(b.subjectOfferingId)),
    );
  });
});

test("Phase 20C Term changes replace history and create a new exact immutable snapshot with audits", async () => {
  await withRollback(async (tx) => {
    const fixture = await createEnrollmentFixture(tx, "11");
    const [offering] = await getProvisionalOfferings(tx, fixture.academicYear.id, "11");
    await approveOfferings(tx, [offering.id], fixture.actor.id);
    const firstTerms = offering.terms.slice(0, 2).map(({ academicTermId }) => academicTermId);
    await selectShsStudentCurriculumInTransaction({ enrollmentId: fixture.enrollment.id, selections: [{ subjectOfferingId: offering.id, academicTermIds: firstTerms }] }, fixture.actor.id, tx);
    const previous = await tx.studentSubjectEnrollment.findFirstOrThrow({ where: { enrollmentId: fixture.enrollment.id, status: "ACTIVE" } });
    const nextTerms = [offering.terms[2].academicTermId];

    assert.deepEqual(await selectShsStudentCurriculumInTransaction({ enrollmentId: fixture.enrollment.id, selections: [{ subjectOfferingId: offering.id, academicTermIds: nextTerms }] }, fixture.actor.id, tx), { created: 1, replaced: 1 });
    const history = await tx.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      include: { terms: true },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(history.length, 2);
    assert.equal(history[0].id, previous.id);
    assert.equal(history[0].status, "REPLACED");
    assert.ok(history[0].replacedAt);
    assert.deepEqual(history[0].terms.map(({ academicTermId }) => academicTermId).sort(), firstTerms.sort());
    assert.equal(history[1].status, "ACTIVE");
    assert.deepEqual(history[1].terms.map(({ academicTermId }) => academicTermId), nextTerms);
    assert.equal(await tx.auditLog.count({ where: { module: "StudentSubjectEnrollment", recordId: { in: history.map(({ id }) => id) } } }), 3);
  });
});

test("Phase 20C removal replaces the active row without hard deletion", async () => {
  await withRollback(async (tx) => {
    const fixture = await createEnrollmentFixture(tx, "11");
    const [offering] = await getProvisionalOfferings(tx, fixture.academicYear.id, "11");
    await approveOfferings(tx, [offering.id], fixture.actor.id);
    await selectShsStudentCurriculumInTransaction({ enrollmentId: fixture.enrollment.id, selections: [{ subjectOfferingId: offering.id, academicTermIds: [offering.terms[0].academicTermId] }] }, fixture.actor.id, tx);

    assert.deepEqual(await selectShsStudentCurriculumInTransaction({ enrollmentId: fixture.enrollment.id, selections: [] }, fixture.actor.id, tx), { created: 0, replaced: 1 });
    const rows = await tx.studentSubjectEnrollment.findMany({ where: { enrollmentId: fixture.enrollment.id } });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "REPLACED");
    assert.ok(rows[0].replacedAt);
  });
});

test("Phase 20C rejects provisional Offerings and Terms outside SubjectOfferingTerm configuration", async () => {
  await withRollback(async (tx) => {
    const fixture = await createEnrollmentFixture(tx, "11");
    const [offering] = await getProvisionalOfferings(tx, fixture.academicYear.id, "11");
    await assert.rejects(
      selectShsStudentCurriculumInTransaction({ enrollmentId: fixture.enrollment.id, selections: [{ subjectOfferingId: offering.id, academicTermIds: [offering.terms[0].academicTermId] }] }, fixture.actor.id, tx),
      /school-approved SSHS offerings/i,
    );

    await approveOfferings(tx, [offering.id], fixture.actor.id);
    await assert.rejects(
      selectShsStudentCurriculumInTransaction({ enrollmentId: fixture.enrollment.id, selections: [{ subjectOfferingId: offering.id, academicTermIds: [randomUUID()] }] }, fixture.actor.id, tx),
      /configured Academic Terms/i,
    );
  });
});

test("Phase 20C leaves regular JHS full-three-Term derivation unchanged", async () => {
  await withRollback(async (tx) => {
    const fixture = await createEnrollmentFixture(tx, "10");
    await deriveApprovedRegularJhsStudentSubjectEnrollments({
      enrollmentId: fixture.enrollment.id,
      academicYearId: fixture.academicYear.id,
      academicYearLabel: fixture.academicYear.label,
      gradeLevel: "10",
      trackStrand: null,
      studentLrn: fixture.student.lrn,
      actorId: fixture.actor.id,
    }, tx);
    const rows = await tx.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id, status: "ACTIVE" },
      select: { terms: { select: { academicTermId: true } } },
    });
    assert.equal(rows.length, 8);
    assert.ok(rows.every(({ terms }) => terms.length === 3));
  });
});
