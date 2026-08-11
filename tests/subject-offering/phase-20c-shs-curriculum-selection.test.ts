import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { createShsStudentSubjectEnrollmentsFromOfferings, findEligibleShsOfferingsForEnrollment, replaceDeselectedShsStudentSubjectEnrollments } from "../../repositories/student-subject-enrollment.repository";

class RollbackFixture extends Error {}

async function fixture(tx: Prisma.TransactionClient, gradeLevel = "11") {
  const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
  const offering = await tx.subjectOffering.findFirstOrThrow({ where: { academicYearId: "academic-year-2026-2027", gradeLevel, deletedAt: null, shsContext: { is: { curriculumStatus: "PROVISIONAL_DEPED" } } }, include: { shsContext: true } });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const section = await tx.section.create({ data: { gradeLevel, sectionName: `P20C ${suffix}`, createdById: actor.id } });
  const student = await tx.student.create({ data: { lrn: `P20C${suffix}`, firstName: "Phase", lastName: "TwentyC", gender: "FEMALE", barangay: "Test", municipality: "Test", province: "Test", createdById: actor.id } });
  const enrollment = await tx.enrollment.create({ data: { studentId: student.id, sectionId: section.id, academicYearId: "academic-year-2026-2027", createdById: actor.id } });
  return { actor, offering, enrollment };
}

test("Phase 20C approval requires complete metadata and preserves provisional selection blocking", async () => {
  await assert.rejects(prisma.$transaction(async (tx) => {
    const data = await fixture(tx);
    await tx.subjectOfferingShsContext.update({ where: { subjectOfferingId: data.offering.id }, data: { curriculumStatus: "SCHOOL_APPROVED", approvalReference: "Board 20C" } });
  }), /provenance_check/i);

  await assert.rejects(prisma.$transaction(async (tx) => {
    const data = await fixture(tx);
    await tx.studentSubjectEnrollment.create({ data: { enrollmentId: data.enrollment.id, subjectOfferingId: data.offering.id, subjectCode: data.offering.subjectCode, subjectDescription: data.offering.subjectDescription, gradeLevel: "11", createdById: data.actor.id } });
  }), /Provisional DepEd Subject Offerings cannot materialize/i);
});

test("Phase 20C approved selection copies exact Terms and SSHS snapshots and replacement preserves history", async () => {
  try {
    await prisma.$transaction(async (tx) => {
      const data = await fixture(tx);
      await tx.subjectOfferingShsContext.update({ where: { subjectOfferingId: data.offering.id }, data: { curriculumStatus: "SCHOOL_APPROVED", approvalReference: "Board 20C", approvedById: data.actor.id, approvedAt: new Date() } });
      await tx.auditLog.create({ data: { userId: data.actor.id, action: "UPDATE", module: "SubjectOffering", recordId: data.offering.id, recordName: data.offering.subjectCode, description: "Approved provisional SSHS subject offering for school use." } });
      const eligible = await findEligibleShsOfferingsForEnrollment("academic-year-2026-2027", "11", tx);
      const selected = eligible.find((offering) => offering.id === data.offering.id)!;
      assert.ok(selected);
      const created = await createShsStudentSubjectEnrollmentsFromOfferings(data.enrollment.id, [selected], data.actor.id, tx);
      await tx.auditLog.create({ data: { userId: data.actor.id, action: "CREATE", module: "StudentSubjectEnrollment", recordId: created[0].id, recordName: created[0].subjectCode, description: "Selected school-approved SSHS subject offering for enrollment." } });
      const row = await tx.studentSubjectEnrollment.findUniqueOrThrow({ where: { id: created[0].id }, include: { terms: { orderBy: { academicTerm: { position: "asc" } } } } });
      assert.equal(row.shsCurriculumStatus, "SCHOOL_APPROVED");
      assert.equal(row.shsClassification, selected.shsContext!.classification);
      assert.equal(row.shsApprovalReference, "Board 20C");
      assert.deepEqual(row.terms.map((term) => term.academicTermId), selected.terms.map((term) => term.academicTermId));
      const replaced = await replaceDeselectedShsStudentSubjectEnrollments(data.enrollment.id, [], new Date(), tx);
      assert.equal(replaced.length, 1);
      assert.equal((await tx.studentSubjectEnrollment.findUniqueOrThrow({ where: { id: row.id } })).status, "REPLACED");
      assert.ok(await tx.auditLog.count({ where: { recordId: data.offering.id, module: "SubjectOffering" } }) >= 2);
      throw new RollbackFixture();
    });
  } catch (error) { if (!(error instanceof RollbackFixture)) throw error; }
});

test("Phase 20C eligibility remains grade and academic-year scoped, including Grade 12 candidates", async () => {
  await prisma.$transaction(async (tx) => {
    const gradeEleven = await fixture(tx, "11");
    const gradeTwelve = await fixture(tx, "12");
    await tx.subjectOfferingShsContext.updateMany({ where: { subjectOfferingId: { in: [gradeEleven.offering.id, gradeTwelve.offering.id] } }, data: { curriculumStatus: "SCHOOL_APPROVED", approvalReference: "Board 20C", approvedById: gradeEleven.actor.id, approvedAt: new Date() } });
    const [eligibleEleven, eligibleTwelve] = await Promise.all([findEligibleShsOfferingsForEnrollment("academic-year-2026-2027", "11", tx), findEligibleShsOfferingsForEnrollment("academic-year-2026-2027", "12", tx)]);
    assert.ok(eligibleEleven.some((offering) => offering.id === gradeEleven.offering.id));
    assert.ok(!eligibleEleven.some((offering) => offering.id === gradeTwelve.offering.id));
    assert.ok(eligibleTwelve.some((offering) => offering.id === gradeTwelve.offering.id));
    throw new RollbackFixture();
  }).catch((error) => { if (!(error instanceof RollbackFixture)) throw error; });
});
