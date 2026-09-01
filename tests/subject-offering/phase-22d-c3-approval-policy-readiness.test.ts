import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";

test("Phase 22D-B2 retains the approved policy-ready finalized Curriculum", async () => {
  const year = await prisma.academicYear.findFirstOrThrow({ where: { label: "2026-2027", status: "ACTIVE" }, select: { id: true } });
  const [offerings, offeringTerms, contexts, policies, finalizations, approved, provisional] = await Promise.all([
    prisma.subjectOffering.count({ where: { academicYearId: year.id, deletedAt: null } }),
    prisma.subjectOfferingTerm.count({ where: { subjectOffering: { academicYearId: year.id, deletedAt: null } } }),
    prisma.subjectOfferingShsContext.findMany({ where: { subjectOffering: { academicYearId: year.id, deletedAt: null } }, select: { curriculumStatus: true, approvalReference: true, approvedById: true, approvedAt: true } }),
    prisma.shsElectiveEnrollmentPolicy.findMany({ where: { academicYearId: year.id }, select: { gradeLevel: true, academicTerm: { select: { position: true } }, minimumElectives: true, maximumElectives: true }, orderBy: [{ gradeLevel: "asc" }, { academicTerm: { position: "asc" } }] }),
    prisma.curriculumFinalization.count({ where: { academicYearId: year.id } }),
    prisma.subjectOffering.count({ where: { academicYearId: year.id, deletedAt: null, shsContext: { curriculumStatus: "SCHOOL_APPROVED" } } }),
    prisma.subjectOffering.count({ where: { academicYearId: year.id, deletedAt: null, shsContext: { curriculumStatus: "PROVISIONAL_DEPED" } } }),
  ]);
  assert.equal(offerings, 40);
  assert.equal(offeringTerms, 116);
  assert.equal(contexts.length, 8);
  assert.equal(approved, 8);
  assert.equal(provisional, 0);
  assert.equal(finalizations, 1);
  contexts.forEach((context) => {
    assert.equal(context.curriculumStatus, "SCHOOL_APPROVED");
    assert.equal(context.approvalReference, "DepEd Order No. 017, s. 2026 – Strengthened Senior High School Curriculum");
    assert.ok(context.approvedById);
    assert.ok(context.approvedAt);
  });
  assert.deepEqual(policies.map(({ gradeLevel, academicTerm, minimumElectives, maximumElectives }) => ({ gradeLevel, position: academicTerm.position, minimumElectives, maximumElectives })), [
    { gradeLevel: "11", position: 1, minimumElectives: 1, maximumElectives: 1 }, { gradeLevel: "11", position: 2, minimumElectives: 1, maximumElectives: 1 }, { gradeLevel: "11", position: 3, minimumElectives: 1, maximumElectives: 1 },
    { gradeLevel: "12", position: 1, minimumElectives: 0, maximumElectives: 0 }, { gradeLevel: "12", position: 2, minimumElectives: 0, maximumElectives: 0 }, { gradeLevel: "12", position: 3, minimumElectives: 0, maximumElectives: 0 },
  ]);
});
