import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";

const categories = [
  ["FIL", "Filipino"],
  ["ENG", "English"],
  ["MATH", "Mathematics"],
  ["SCI", "Science"],
  ["AP", "Araling Panlipunan"],
  ["MAPEH", "MAPEH"],
  ["TLE", "TLE"],
  ["GMRC", "GMRC / Values Education"],
] as const;

test("2026-2027 JHS baseline has one full-year Offering per approved grade and category", async () => {
  const academicYear = await prisma.academicYear.findFirstOrThrow({
    where: { label: "2026-2027" },
    select: { id: true },
  });

  const [subjects, offerings] = await Promise.all([
    prisma.subject.findMany({
      where: { deletedAt: null, gradeLevel: { in: ["7", "8", "9", "10"] } },
      select: { code: true, description: true, gradeLevel: true },
    }),
    prisma.subjectOffering.findMany({
      where: {
          academicYearId: academicYear.id,
        gradeLevel: { in: ["7", "8", "9", "10"] },
        deletedAt: null,
      },
      select: { subjectCode: true, subjectDescription: true, gradeLevel: true, terms: true },
    }),
  ]);

  const expected = ["7", "8", "9", "10"].flatMap((grade) =>
    categories.map(([prefix, description]) => ({
      code: `${prefix}${grade}`,
      description,
      grade,
    })),
  );

  assert.equal(subjects.length, 32);
  assert.equal(offerings.length, 32);

  for (const item of expected) {
    assert.deepEqual(
      subjects.find((subject) => subject.code === item.code),
      { code: item.code, description: item.description, gradeLevel: item.grade },
    );
    const offering = offerings.find((value) => value.subjectCode === item.code);
    assert.equal(offering?.subjectDescription, item.description);
    assert.equal(offering?.gradeLevel, item.grade);
    assert.equal(offering?.terms.length, 3);
  }
});

test("2026-2027 Grade 11 Core baseline has five approved full-year Offerings", async () => {
  const academicYear = await prisma.academicYear.findFirstOrThrow({
    where: { label: "2026-2027", status: "ACTIVE" },
    select: { id: true },
  });
  const expected = [
    ["SSHS-G11-CORE-01", "Effective Communication / Mabisang Komunikasyon"],
    ["SSHS-G11-CORE-02", "Life and Career Skills"],
    ["SSHS-G11-CORE-03", "General Mathematics"],
    ["SSHS-G11-CORE-04", "General Science"],
    ["SSHS-G11-CORE-05", "Pag-aaral ng Kasaysayan at Lipunang Pilipino"],
  ] as const;
  const [subjects, offerings, createAuditCount, approvalAuditCount] = await Promise.all([
    prisma.subject.findMany({
      where: { code: { in: expected.map(([code]) => code) }, gradeLevel: "11", deletedAt: null },
      select: { code: true, description: true },
    }),
    prisma.subjectOffering.findMany({
      where: { academicYearId: academicYear.id, gradeLevel: "11", subjectCode: { in: expected.map(([code]) => code) }, deletedAt: null },
      select: {
        subjectCode: true,
        subjectDescription: true,
        terms: { select: { academicTerm: { select: { position: true } } }, orderBy: { academicTerm: { position: "asc" } } },
        shsContext: { select: { classification: true, clusterId: true, curriculumStatus: true, sourceReference: true, approvalReference: true, approvedById: true, approvedAt: true } },
      },
    }),
    prisma.auditLog.count({
      where: { module: "SubjectOffering", action: "CREATE", recordName: { in: expected.map(([code]) => `${code} - 2026-2027`) } },
    }),
    prisma.auditLog.count({
      where: {
        module: "SubjectOffering",
        action: "UPDATE",
        recordName: { in: expected.map(([code]) => `${code} - 2026-2027`) },
        description: "Approved SSHS subject offering for school use.",
      },
    }),
  ]);

  assert.equal(subjects.length, 5);
  assert.equal(offerings.length, 5);
  assert.equal(createAuditCount, 5);
  assert.equal(approvalAuditCount, 5);

  for (const [code, description] of expected) {
    assert.deepEqual(subjects.find((subject) => subject.code === code), { code, description });
    const offering = offerings.find((value) => value.subjectCode === code);
    assert.equal(offering?.subjectDescription, description);
    assert.deepEqual(offering?.terms.map((term) => term.academicTerm.position), [1, 2, 3]);
    assert.equal(offering?.shsContext?.classification, "CORE");
    assert.equal(offering?.shsContext?.clusterId, null);
    assert.equal(offering?.shsContext?.curriculumStatus, "SCHOOL_APPROVED");
    assert.equal(offering?.shsContext?.approvalReference, `DEMO-BOT-AY2026-2027-${code}`);
    assert.ok(offering?.shsContext?.approvedById);
    assert.ok(offering?.shsContext?.approvedAt);
    const sourceReference = offering?.shsContext?.sourceReference;
    assert.equal(typeof sourceReference, "string");
    assert.ok(sourceReference?.includes("DM_s2026_012r.pdf"));
    assert.ok(sourceReference?.includes("DO-017-s.-2026"));
  }
});
