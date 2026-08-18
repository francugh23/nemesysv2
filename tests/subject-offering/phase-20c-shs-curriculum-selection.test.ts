import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { ShsCurrentTermProgressionSchema } from "../../schemas/student-subject-enrollment.schema";
import { deriveApprovedRegularJhsStudentSubjectEnrollments } from "../../services/jhs-student-subject-enrollment-derivation.service";

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

test("Phase 20C mutation is retired in favor of the strict server-Term progression contract", () => {
  assert.equal(ShsCurrentTermProgressionSchema.safeParse({ enrollmentId: "enrollment-1", subjectOfferingIds: ["offering-1"] }).success, true);
  assert.equal(ShsCurrentTermProgressionSchema.safeParse({ enrollmentId: "enrollment-1", subjectOfferingIds: ["offering-1", "offering-1"] }).success, false);
  assert.equal(ShsCurrentTermProgressionSchema.safeParse({ enrollmentId: "enrollment-1", subjectOfferingIds: [], academicTermId: "client-term" }).success, false);
  const action = readFileSync(path.join(process.cwd(), "actions/student-subject-enrollment.action.ts"), "utf8");
  const hook = readFileSync(path.join(process.cwd(), "hooks/student-subject-enrollment.hook.ts"), "utf8");
  assert.doesNotMatch(action, /selectShsStudentCurriculumAction|getEligibleShsOfferingsForEnrollmentAction/);
  assert.doesNotMatch(hook, /useSelectShsStudentCurriculum|useEligibleShsOfferingsForEnrollment/);
});

test("Phase 20C historical null-identity rows and immutable Term snapshots remain readable", async () => {
  const rows = await prisma.studentSubjectEnrollment.findMany({
    where: { selectionAcademicTermId: null, shsCurriculumStatus: { not: null } },
    select: {
      id: true,
      status: true,
      selectionAcademicTermId: true,
      subjectCode: true,
      shsClassification: true,
      terms: { select: { academicTermId: true }, orderBy: { academicTerm: { position: "asc" } } },
    },
    orderBy: { id: "asc" },
  });
  assert.ok(rows.length > 0);
  assert.ok(rows.every(({ selectionAcademicTermId, terms }) => selectionAcademicTermId === null && terms.length > 0));
});

test("Phase 20C retirement leaves regular JHS full-three-Term derivation unchanged", async () => {
  await withRollback(async (tx) => {
    const [actor, academicYear] = await Promise.all([
      tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } }),
      tx.academicYear.findFirstOrThrow({ where: { status: "ACTIVE" }, select: { id: true, label: true } }),
    ]);
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const section = await tx.section.create({ data: { gradeLevel: "10", sectionName: `P20C ${suffix}`, createdById: actor.id } });
    const student = await tx.student.create({ data: { lrn: `P20C${suffix}`, firstName: "Phase", lastName: "TwentyC", gender: "FEMALE", barangay: "Test", municipality: "Test", province: "Test", createdById: actor.id } });
    const enrollment = await tx.enrollment.create({ data: { studentId: student.id, sectionId: section.id, academicYearId: academicYear.id, createdById: actor.id } });
    await deriveApprovedRegularJhsStudentSubjectEnrollments({
      enrollmentId: enrollment.id,
      academicYearId: academicYear.id,
      academicYearLabel: academicYear.label,
      gradeLevel: "10",
      trackStrand: null,
      studentLrn: student.lrn,
      actorId: actor.id,
    }, tx);
    const rows = await tx.studentSubjectEnrollment.findMany({
      where: { enrollmentId: enrollment.id, status: "ACTIVE" },
      select: { selectionAcademicTermId: true, terms: { select: { academicTermId: true } } },
    });
    assert.equal(rows.length, 8);
    assert.ok(rows.every(({ selectionAcademicTermId, terms }) => selectionAcademicTermId === null && terms.length === 3));
  });
});
