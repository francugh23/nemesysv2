import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import { hasPermission, Permissions } from "../../lib/permissions";
import prisma from "../../lib/prisma";
import { createAuditLogs } from "../../repositories/audit.repository";
import { createShsElectiveEnrollmentPolicy } from "../../repositories/shs-elective-enrollment-policy.repository";
import { makeLegacyActiveCurriculumConfigurable } from "../helpers/phase-21e-e1-legacy-fixture";
import {
  CreateShsElectiveEnrollmentPolicySchema,
} from "../../schemas/shs-elective-enrollment-policy.schema";

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

async function createFixture(tx: Prisma.TransactionClient) {
  const [actor, year] = await Promise.all([
    tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } }),
    tx.academicYear.findFirstOrThrow({ where: { status: "ACTIVE" }, select: { id: true, terms: { select: { id: true }, orderBy: { position: "asc" } } } }),
  ]);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const section = await tx.section.create({ data: { gradeLevel: "11", sectionName: `B1 ${suffix}`, createdById: actor.id } });
  const student = await tx.student.create({ data: { lrn: `B1${suffix}`, firstName: "Progressive", lastName: "Foundation", gender: "FEMALE", barangay: "Test", municipality: "Test", province: "Test", createdById: actor.id } });
  const enrollment = await tx.enrollment.create({ data: { studentId: student.id, sectionId: section.id, academicYearId: year.id, entryAcademicTermId: year.terms[0]!.id, shsTrack: "ACADEMIC", createdById: actor.id } });
  const offerings = await tx.subjectOffering.findMany({
    where: { academicYearId: year.id, gradeLevel: "11", deletedAt: null, terms: { some: { academicTermId: year.terms[0]!.id } }, shsContext: { is: { classification: { in: ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"] } } } },
    select: { id: true, subjectCode: true, subjectDescription: true, gradeLevel: true, terms: { select: { academicTermId: true }, orderBy: { academicTerm: { position: "asc" } } }, shsContext: { select: { classification: true, curriculumStatus: true, sourceReference: true, approvalReference: true, cluster: { select: { code: true, name: true } } } } },
  });
  const offering = offerings.find(({ terms }) => terms.length >= 2) ?? offerings[0];
  assert.ok(offering);
  if (offering.shsContext!.curriculumStatus === "PROVISIONAL_DEPED") {
    await tx.subjectOfferingShsContext.update({ where: { subjectOfferingId: offering.id }, data: { curriculumStatus: "SCHOOL_APPROVED", approvalReference: "B1 test approval", approvedById: actor.id, approvedAt: new Date() } });
  }
  const context = await tx.subjectOfferingShsContext.findUniqueOrThrow({ where: { subjectOfferingId: offering.id }, include: { cluster: true } });
  const createParticipation = (selectionAcademicTermId: string | null) => tx.studentSubjectEnrollment.create({ data: {
    enrollmentId: enrollment.id, subjectOfferingId: offering.id, selectionAcademicTermId,
    subjectCode: offering.subjectCode, subjectDescription: offering.subjectDescription, gradeLevel: offering.gradeLevel,
    shsClassification: context.classification, shsClusterCode: context.cluster?.code, shsClusterName: context.cluster?.name,
    shsCurriculumStatus: context.curriculumStatus, shsSourceReference: context.sourceReference, shsApprovalReference: context.approvalReference,
    createdById: actor.id,
    terms: { create: [{ academicTermId: selectionAcademicTermId ?? offering.terms[0]!.academicTermId }] },
  } });
  return { actor, year, enrollment, offering, createParticipation };
}

test("B1 lifecycle reserves SHS replacement for controlled correction and rejects invalid timestamp combinations", async () => {
  await withRollback(async (tx) => {
    const fixture = await createFixture(tx);
    const dropped = await fixture.createParticipation(fixture.offering.terms[0]!.academicTermId);
    await tx.studentSubjectEnrollment.update({ where: { id: dropped.id }, data: { status: "DROPPED", droppedAt: new Date(), dropReason: "Student withdrawal" } });
    await assert.rejects(tx.$executeRaw`UPDATE "StudentSubjectEnrollment" SET "status"='ACTIVE', "replacedAt"=NOW() WHERE "id"=${dropped.id}`);
  });
  await assert.rejects(prisma.$transaction(async (tx) => {
    const fixture = await createFixture(tx);
    const active = await fixture.createParticipation(fixture.offering.terms[0]!.academicTermId);
    await tx.studentSubjectEnrollment.update({ where: { id: active.id }, data: { status: "REPLACED", replacedAt: new Date() } });
  }));
  await assert.rejects(prisma.$transaction(async (tx) => {
    const fixture = await createFixture(tx);
    const row = await fixture.createParticipation(fixture.offering.terms[0]!.academicTermId);
    await tx.$executeRaw`UPDATE "StudentSubjectEnrollment" SET "status"='DROPPED', "droppedAt"=NOW(), "dropReason"=' ' WHERE "id"=${row.id}`;
  }));
});

test("B1 lifecycle permits DROP and freezes terminal records", async () => {
  await withRollback(async (tx) => {
    const fixture = await createFixture(tx);
    const row = await fixture.createParticipation(fixture.offering.terms[0]!.academicTermId);
    await tx.studentSubjectEnrollment.update({ where: { id: row.id }, data: { status: "DROPPED", droppedAt: new Date(), dropReason: "Documented withdrawal" } });
    await assert.rejects(tx.studentSubjectEnrollment.update({ where: { id: row.id }, data: { status: "REPLACED", replacedAt: new Date(), droppedAt: null, dropReason: null } }));
  });
});

test("B1 Term memberships accept valid inserts and reject update, delete, and cross-year inserts", async () => {
  await withRollback(async (tx) => {
    const fixture = await createFixture(tx);
    const row = await fixture.createParticipation(fixture.offering.terms[0]!.academicTermId);
    await assert.rejects(tx.studentSubjectEnrollmentTerm.update({ where: { studentSubjectEnrollmentId_academicTermId: { studentSubjectEnrollmentId: row.id, academicTermId: fixture.offering.terms[0]!.academicTermId } }, data: { academicTermId: fixture.offering.terms[1]?.academicTermId ?? randomUUID() } }));
  });
  await withRollback(async (tx) => {
    const fixture = await createFixture(tx);
    const row = await fixture.createParticipation(fixture.offering.terms[0]!.academicTermId);
    await assert.rejects(tx.studentSubjectEnrollmentTerm.delete({ where: { studentSubjectEnrollmentId_academicTermId: { studentSubjectEnrollmentId: row.id, academicTermId: fixture.offering.terms[0]!.academicTermId } } }));
  });
  await withRollback(async (tx) => {
    const fixture = await createFixture(tx);
    const row = await fixture.createParticipation(fixture.offering.terms[0]!.academicTermId);
    const otherYear = await tx.academicYear.create({ data: { label: "2098-2099", startDate: new Date("2098-06-01T00:00:00.000Z"), endDate: new Date("2099-04-01T00:00:00.000Z"), createdById: fixture.actor.id } });
    const otherTerm = await tx.academicTerm.create({ data: { academicYearId: otherYear.id, name: "Other Term", position: 1, startDate: new Date("2098-06-01T00:00:00.000Z"), endDate: new Date("2098-08-01T00:00:00.000Z"), createdById: fixture.actor.id } });
    await assert.rejects(tx.studentSubjectEnrollmentTerm.create({ data: { studentSubjectEnrollmentId: row.id, academicTermId: otherTerm.id } }));
  });
});

test("B1 Term-scoped identity allows distinct Terms and rejects duplicate active coverage", async () => {
  await withRollback(async (tx) => {
    const fixture = await createFixture(tx);
    assert.ok(fixture.offering.terms.length >= 2);
    const first = await fixture.createParticipation(fixture.offering.terms[0]!.academicTermId);
    const second = await fixture.createParticipation(fixture.offering.terms[1]!.academicTermId);
    await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
    assert.notEqual(first.id, second.id);
    assert.equal((await tx.studentSubjectEnrollment.findUniqueOrThrow({ where: { id: first.id } })).selectionAcademicTermId, fixture.offering.terms[0]!.academicTermId);
    await assert.rejects(tx.studentSubjectEnrollment.update({ where: { id: first.id }, data: { status: "REPLACED", replacedAt: new Date() } }));
  });
  await assert.rejects(prisma.$transaction(async (tx) => {
    const fixture = await createFixture(tx);
    await fixture.createParticipation(fixture.offering.terms[0]!.academicTermId);
    await fixture.createParticipation(fixture.offering.terms[0]!.academicTermId);
  }));
});

test("B1 preserves readable legacy null selection identity", async () => {
  await withRollback(async (tx) => {
    const fixture = await createFixture(tx);
    const legacy = await fixture.createParticipation(null);
    assert.equal(legacy.selectionAcademicTermId, null);
  });
});

test("B1 elective policy schema and database enforce scope and counts", async () => {
  assert.equal(CreateShsElectiveEnrollmentPolicySchema.safeParse({ academicYearId: "year", academicTermId: "term", gradeLevel: "12", minimumElectives: 0, maximumElectives: 0 }).success, true);
  assert.equal(CreateShsElectiveEnrollmentPolicySchema.safeParse({ academicYearId: "year", academicTermId: "term", gradeLevel: "12", minimumElectives: 0, maximumElectives: 1 }).success, true);
  assert.equal(CreateShsElectiveEnrollmentPolicySchema.safeParse({ academicYearId: "year", academicTermId: "term", gradeLevel: "11", minimumElectives: 1, maximumElectives: 3 }).success, true);
  assert.equal(CreateShsElectiveEnrollmentPolicySchema.safeParse({ academicYearId: "year", academicTermId: "term", gradeLevel: "10", minimumElectives: 1, maximumElectives: 3 }).success, false);
  assert.equal(CreateShsElectiveEnrollmentPolicySchema.safeParse({ academicYearId: "year", academicTermId: "term", gradeLevel: "12", minimumElectives: -1, maximumElectives: 0 }).success, false);
  assert.equal(CreateShsElectiveEnrollmentPolicySchema.safeParse({ academicYearId: "year", academicTermId: "term", gradeLevel: "12", minimumElectives: 0, maximumElectives: 4 }).success, false);
  assert.equal(CreateShsElectiveEnrollmentPolicySchema.safeParse({ academicYearId: "year", academicTermId: "term", gradeLevel: "12", minimumElectives: 3, maximumElectives: 2 }).success, false);
  await withRollback(async (tx) => {
    const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null } });
    const year = await tx.academicYear.findFirstOrThrow({ where: { status: "ACTIVE" }, include: { terms: true } });
    await makeLegacyActiveCurriculumConfigurable(year.id, tx);
    const values = { academicYearId: year.id, academicTermId: year.terms[0]!.id, gradeLevel: "12" as const, minimumElectives: 0, maximumElectives: 0 };
    const beforeAudits = await tx.auditLog.count();
    const policy = await createShsElectiveEnrollmentPolicy({ ...values, createdById: actor.id }, tx);
    await createAuditLogs([{ userId: actor.id, action: "CREATE", module: "ShsElectiveEnrollmentPolicy", recordId: policy.id, description: "Created SHS elective enrollment policy." }], tx);
    assert.equal(await tx.auditLog.count(), beforeAudits + 1);
    assert.deepEqual(
      { minimumElectives: policy.minimumElectives, maximumElectives: policy.maximumElectives },
      { minimumElectives: 0, maximumElectives: 0 },
    );
    const optionalPolicy = await tx.shsElectiveEnrollmentPolicy.create({
      data: { ...values, academicTermId: year.terms[1]!.id, minimumElectives: 0, maximumElectives: 1, createdById: actor.id },
    });
    assert.deepEqual(
      { minimumElectives: optionalPolicy.minimumElectives, maximumElectives: optionalPolicy.maximumElectives },
      { minimumElectives: 0, maximumElectives: 1 },
    );
    await assert.rejects(tx.shsElectiveEnrollmentPolicy.create({ data: { ...values, createdById: actor.id } }));
    await assert.rejects(tx.shsElectiveEnrollmentPolicy.create({ data: { ...values, gradeLevel: "10", academicTermId: year.terms[1]!.id, createdById: actor.id } }));
    await assert.rejects(tx.shsElectiveEnrollmentPolicy.create({ data: { ...values, academicTermId: year.terms[2]!.id, minimumElectives: -1, maximumElectives: 0, createdById: actor.id } }));
    await assert.rejects(tx.shsElectiveEnrollmentPolicy.create({ data: { ...values, academicTermId: year.terms[2]!.id, minimumElectives: 0, maximumElectives: 4, createdById: actor.id } }));
    await assert.rejects(tx.shsElectiveEnrollmentPolicy.create({ data: { ...values, gradeLevel: "12", academicTermId: year.terms[1]!.id, minimumElectives: 3, maximumElectives: 2, createdById: actor.id } }));
  });
});

test("B1 elective policy rejects a cross-year Term and rolls policy audit back atomically", async () => {
  const before = await Promise.all([
    prisma.shsElectiveEnrollmentPolicy.count(),
    prisma.auditLog.count({ where: { module: "ShsElectiveEnrollmentPolicy" } }),
  ]);
  await withRollback(async (tx) => {
    const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null } });
    const year = await tx.academicYear.findFirstOrThrow({ where: { status: "ACTIVE" }, include: { terms: true } });
    await makeLegacyActiveCurriculumConfigurable(year.id, tx);
    const otherYear = await tx.academicYear.create({ data: { label: "2097-2098", startDate: new Date("2097-06-01T00:00:00.000Z"), endDate: new Date("2098-04-01T00:00:00.000Z"), createdById: actor.id } });
    const otherTerm = await tx.academicTerm.create({ data: { academicYearId: otherYear.id, name: "Other Term", position: 1, startDate: new Date("2097-06-01T00:00:00.000Z"), endDate: new Date("2097-08-01T00:00:00.000Z"), createdById: actor.id } });
    await assert.rejects(tx.shsElectiveEnrollmentPolicy.create({ data: { academicYearId: year.id, academicTermId: otherTerm.id, gradeLevel: "11", minimumElectives: 1, maximumElectives: 3, createdById: actor.id } }));
  });
  await withRollback(async (tx) => {
    const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null } });
    const year = await tx.academicYear.findFirstOrThrow({ where: { status: "ACTIVE" }, include: { terms: true } });
    await makeLegacyActiveCurriculumConfigurable(year.id, tx);
    const policy = await tx.shsElectiveEnrollmentPolicy.create({ data: { academicYearId: year.id, academicTermId: year.terms[2]!.id, gradeLevel: "12", minimumElectives: 1, maximumElectives: 2, createdById: actor.id } });
    await createAuditLogs([{ userId: actor.id, action: "CREATE", module: "ShsElectiveEnrollmentPolicy", recordId: policy.id, description: "Created SHS elective enrollment policy." }], tx);
  });
  assert.deepEqual(await Promise.all([
    prisma.shsElectiveEnrollmentPolicy.count(),
    prisma.auditLog.count({ where: { module: "ShsElectiveEnrollmentPolicy" } }),
  ]), before);
});

test("B1 policy authorization remains Super Admin and Registrar only", () => {
  assert.equal(hasPermission("SUPER_ADMIN", Permissions.SHS_CURRICULUM_APPROVAL), true);
  assert.equal(hasPermission("REGISTRAR", Permissions.SHS_CURRICULUM_APPROVAL), true);
  assert.equal(hasPermission("PRINCIPAL", Permissions.SHS_CURRICULUM_APPROVAL), false);
  assert.equal(hasPermission("TEACHER", Permissions.SHS_CURRICULUM_APPROVAL), false);
  const action = readFileSync(path.join(process.cwd(), "actions/shs-elective-enrollment-policy.action.ts"), "utf8");
  const service = readFileSync(path.join(process.cwd(), "services/shs-elective-enrollment-policy.service.ts"), "utf8");
  assert.match(action, /requirePermission\(Permissions\.SHS_CURRICULUM_APPROVAL\)/);
  assert.match(service, /requirePermission\(Permissions\.SHS_CURRICULUM_APPROVAL\)/);
});
