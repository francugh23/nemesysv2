import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";

const expected = [
  ["SSHS-G11-ACA-ASSH-01", "Contemporary Literature 1", "ACADEMIC_ELECTIVE", "ACA-ASSH", [1]],
  ["SSHS-G11-ACA-ASSH-02", "Contemporary Literature 2", "ACADEMIC_ELECTIVE", "ACA-ASSH", [2]],
  ["SSHS-G11-TP-CADT-01", "Visual Graphic Design", "TECHPRO_ELECTIVE", "TP-CADT", [1, 2, 3]],
] as const;

test("Phase 22D-A retains only three provisional Grade 11 elective Offerings", async () => {
  const year = await prisma.academicYear.findFirstOrThrow({ where: { label: "2026-2027", status: "ACTIVE" }, select: { id: true } });
  const offerings = await prisma.subjectOffering.findMany({ where: { academicYearId: year.id, gradeLevel: "11", deletedAt: null, shsContext: { classification: { in: ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"] } } }, select: { subjectCode: true, subjectDescription: true, terms: { select: { academicTerm: { select: { position: true } } }, orderBy: { academicTerm: { position: "asc" } } }, shsContext: { select: { classification: true, curriculumStatus: true, approvalReference: true, cluster: { select: { code: true } } } } } });
  assert.equal(offerings.length, 3);
  for (const [code, description, classification, cluster, positions] of expected) {
    const offering = offerings.find((item) => item.subjectCode === code);
    assert.equal(offering?.subjectDescription, description);
    assert.equal(offering?.shsContext?.classification, classification);
    assert.equal(offering?.shsContext?.cluster?.code, cluster);
    assert.deepEqual(offering?.terms.map(({ academicTerm }) => academicTerm.position), positions);
    assert.equal(offering?.shsContext?.curriculumStatus, "PROVISIONAL_DEPED");
    assert.equal(offering?.shsContext?.approvalReference, null);
  }
});
