import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";

const expected = [
  ["SSHS-G11-ASSH-CL1", "Contemporary Literature 1", "ACADEMIC_ELECTIVE", "ACA-ASSH", [1]],
  ["SSHS-G11-ASSH-CL2", "Contemporary Literature 2", "ACADEMIC_ELECTIVE", "ACA-ASSH", [2]],
  ["SSHS-G11-STEM-BIO1", "Biology 1", "ACADEMIC_ELECTIVE", "ACA-STEM", [1]],
  ["SSHS-G11-STEM-BIO2", "Biology 2", "ACADEMIC_ELECTIVE", "ACA-STEM", [2]],
  ["SSHS-G11-CADT-VGD", "Visual Graphic Design", "TECHPRO_ELECTIVE", "TP-CADT", [1, 2, 3]],
  ["SSHS-G11-HT-FBO", "Food and Beverage Operation", "TECHPRO_ELECTIVE", "TP-HT", [1, 2, 3]],
] as const;

test("2026-2027 Grade 11 elective foundation retains six approved demo Offerings", async () => {
  const academicYear = await prisma.academicYear.findFirstOrThrow({
    where: { label: "2026-2027", status: "ACTIVE" },
    select: { id: true },
  });
  const [subjects, offerings, createAudits, approvalAudits] = await Promise.all([
    prisma.subject.findMany({
      where: { code: { in: expected.map(([code]) => code) }, gradeLevel: "11", deletedAt: null },
      select: { code: true, description: true, gradeLevel: true },
    }),
    prisma.subjectOffering.findMany({
      where: { academicYearId: academicYear.id, subjectCode: { in: expected.map(([code]) => code) }, deletedAt: null },
      select: {
        subjectCode: true,
        subjectDescription: true,
        terms: { select: { academicTerm: { select: { position: true } } }, orderBy: { academicTerm: { position: "asc" } } },
        shsContext: { select: { classification: true, curriculumStatus: true, sourceReference: true, approvalReference: true, approvedById: true, approvedAt: true, cluster: { select: { code: true } } } },
      },
    }),
    prisma.auditLog.count({
      where: { module: "SubjectOffering", action: "CREATE", recordName: { in: expected.map(([code]) => `${code} - 2026-2027`) } },
    }),
    prisma.auditLog.count({
      where: { module: "SubjectOffering", action: "UPDATE", recordName: { in: expected.map(([code]) => `${code} - 2026-2027`) }, description: "Approved SSHS subject offering for school use." },
    }),
  ]);

  assert.equal(subjects.length, 6);
  assert.equal(offerings.length, 6);
  assert.equal(createAudits, 6);
  assert.equal(approvalAudits, 6);

  for (const [code, description, classification, clusterCode, positions] of expected) {
    assert.deepEqual(subjects.find((subject) => subject.code === code), {
      code,
      description,
      gradeLevel: "11",
    });
    const offering = offerings.find((item) => item.subjectCode === code);
    assert.equal(offering?.subjectDescription, description);
    assert.deepEqual(offering?.terms.map((term) => term.academicTerm.position), positions);
    assert.equal(offering?.shsContext?.classification, classification);
    assert.equal(offering?.shsContext?.cluster?.code, clusterCode);
    assert.equal(offering?.shsContext?.curriculumStatus, "SCHOOL_APPROVED");
    assert.ok(offering?.shsContext?.sourceReference?.includes("deped.gov.ph"));
    assert.equal(offering?.shsContext?.approvalReference, `DEMO-BOT-AY2026-2027-${code}`);
    assert.ok(offering?.shsContext?.approvedById);
    assert.ok(offering?.shsContext?.approvedAt);
  }
});
