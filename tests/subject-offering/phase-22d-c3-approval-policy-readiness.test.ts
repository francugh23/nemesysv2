import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";

test("Phase 22D-A is policy-ready but deliberately pending SHS approval", async () => {
  const year = await prisma.academicYear.findFirstOrThrow({ where: { label: "2026-2027", status: "ACTIVE" }, select: { id: true } });
  const [offerings, offeringTerms, contexts, policies, finalizations, approved] = await Promise.all([
    prisma.subjectOffering.count({ where: { academicYearId: year.id, deletedAt: null } }),
    prisma.subjectOfferingTerm.count({ where: { subjectOffering: { academicYearId: year.id, deletedAt: null } } }),
    prisma.subjectOfferingShsContext.findMany({ where: { subjectOffering: { academicYearId: year.id, deletedAt: null } }, select: { curriculumStatus: true, approvalReference: true, approvedById: true, approvedAt: true } }),
    prisma.shsElectiveEnrollmentPolicy.findMany({ where: { academicYearId: year.id }, select: { gradeLevel: true, academicTerm: { select: { position: true } }, minimumElectives: true, maximumElectives: true }, orderBy: [{ gradeLevel: "asc" }, { academicTerm: { position: "asc" } }] }),
    prisma.curriculumFinalization.count({ where: { academicYearId: year.id } }),
    prisma.subjectOffering.count({ where: { academicYearId: year.id, deletedAt: null, shsContext: { curriculumStatus: "SCHOOL_APPROVED" } } }),
  ]);
  assert.equal(offerings, 40);
  assert.equal(offeringTerms, 116);
  assert.equal(contexts.length, 8);
  assert.equal(approved, 0);
  assert.equal(finalizations, 0);
  contexts.forEach((context) => {
    assert.equal(context.curriculumStatus, "PROVISIONAL_DEPED");
    assert.equal(context.approvalReference, null);
    assert.equal(context.approvedById, null);
    assert.equal(context.approvedAt, null);
  });
  assert.deepEqual(policies.map(({ gradeLevel, academicTerm, minimumElectives, maximumElectives }) => ({ gradeLevel, position: academicTerm.position, minimumElectives, maximumElectives })), [
    { gradeLevel: "11", position: 1, minimumElectives: 1, maximumElectives: 1 }, { gradeLevel: "11", position: 2, minimumElectives: 1, maximumElectives: 1 }, { gradeLevel: "11", position: 3, minimumElectives: 1, maximumElectives: 1 },
    { gradeLevel: "12", position: 1, minimumElectives: 0, maximumElectives: 0 }, { gradeLevel: "12", position: 2, minimumElectives: 0, maximumElectives: 0 }, { gradeLevel: "12", position: 3, minimumElectives: 0, maximumElectives: 0 },
  ]);
});
