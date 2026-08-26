import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";

const expected = [
  ["SSHS-G12-ACA-ADV-MATH", "Advanced Mathematics", "ACADEMIC_ELECTIVE", "ACA-STEM", 1, "1-Updated-as-of-05.29.26_Advanced-Mathematics.pdf"],
  ["SSHS-G12-TP-CADT-VGD", "Visual Graphic Design", "TECHPRO_ELECTIVE", "TP-CADT", 1, "G12-Visual-Graphic-Design.pdf"],
  ["SSHS-G12-ACA-CPP", "Creative Production and Presentation", "ACADEMIC_ELECTIVE", "ACA-ASSH", 2, "CREATIVE-PRODUCTION-AND-PRESENTATION.pdf"],
  ["SSHS-G12-TP-HT-FBO", "Food and Beverage Operation", "TECHPRO_ELECTIVE", "TP-HT", 2, "G12-Food-and-Beverage-Operation.pdf"],
] as const;

test("2026-2027 Grade 12 pilot has four approved one-Term electives and a 1/1, 1/1, 0/0 policy matrix", async () => {
  const academicYear = await prisma.academicYear.findFirstOrThrow({
    where: { label: "2026-2027", status: "ACTIVE" },
    select: { id: true },
  });
  const [subjectCount, offeringCount, subjects, offerings, policies, auditCounts, zeroState] = await Promise.all([
    prisma.subject.count({ where: { deletedAt: null } }),
    prisma.subjectOffering.count({ where: { academicYearId: academicYear.id, deletedAt: null } }),
    prisma.subject.findMany({
      where: { code: { in: expected.map(([code]) => code) }, gradeLevel: "12", deletedAt: null },
      select: { code: true, description: true, gradeLevel: true },
    }),
    prisma.subjectOffering.findMany({
      where: { academicYearId: academicYear.id, subjectCode: { in: expected.map(([code]) => code) }, deletedAt: null },
      select: {
        subjectCode: true,
        subjectDescription: true,
        terms: { select: { academicTerm: { select: { position: true } } } },
        shsContext: { select: { classification: true, curriculumStatus: true, sourceReference: true, approvalReference: true, approvedById: true, approvedAt: true, cluster: { select: { code: true } } } },
      },
    }),
    prisma.shsElectiveEnrollmentPolicy.findMany({
      where: { academicYearId: academicYear.id, gradeLevel: "12" },
      select: { academicTerm: { select: { position: true } }, minimumElectives: true, maximumElectives: true },
      orderBy: { academicTerm: { position: "asc" } },
    }),
    Promise.all([
      prisma.auditLog.count({ where: { module: "Subject", action: "CREATE", recordName: { in: expected.map(([code]) => code) } } }),
      prisma.auditLog.count({ where: { module: "SubjectOffering", action: "CREATE", recordName: { in: expected.map(([code]) => `${code} - 2026-2027`) } } }),
      prisma.auditLog.count({ where: { module: "SubjectOffering", action: "UPDATE", recordName: { in: expected.map(([code]) => `${code} - 2026-2027`) }, description: "Approved SSHS subject offering for school use." } }),
      prisma.auditLog.count({ where: { module: "ShsElectiveEnrollmentPolicy", action: "CREATE", recordName: { in: ["Grade 12 - Term 1", "Grade 12 - Term 2", "Grade 12 - Term 3"] } } }),
    ]),
    Promise.all([
      prisma.subjectOffering.count({ where: { academicYearId: academicYear.id, gradeLevel: "12", deletedAt: null, shsContext: { classification: "CORE" } } }),
      prisma.teacher.count({ where: { deletedAt: null } }),
      prisma.student.count({ where: { deletedAt: null } }),
      prisma.enrollment.count(),
      prisma.studentSubjectEnrollment.count(),
      prisma.shsTermResult.count(),
      prisma.curriculumFinalization.count(),
    ]),
  ]);

  assert.equal(subjectCount, 47);
  assert.equal(offeringCount, 47);
  assert.equal(subjects.length, 4);
  assert.equal(offerings.length, 4);
  assert.deepEqual(auditCounts, [4, 4, 4, 3]);
  assert.deepEqual(zeroState, Array(7).fill(0));

  for (const [code, description, classification, clusterCode, termPosition, guideFile] of expected) {
    assert.deepEqual(subjects.find((subject) => subject.code === code), { code, description, gradeLevel: "12" });
    const offering = offerings.find((item) => item.subjectCode === code);
    assert.equal(offering?.subjectDescription, description);
    assert.deepEqual(offering?.terms.map((term) => term.academicTerm.position), [termPosition]);
    assert.equal(offering?.shsContext?.classification, classification);
    assert.equal(offering?.shsContext?.cluster?.code, clusterCode);
    assert.equal(offering?.shsContext?.curriculumStatus, "SCHOOL_APPROVED");
    assert.ok(offering?.shsContext?.sourceReference?.includes(guideFile));
    assert.equal(offering?.shsContext?.approvalReference, `DEMO-BOT-AY2026-2027-${code}`);
    assert.ok(offering?.shsContext?.approvedById);
    assert.ok(offering?.shsContext?.approvedAt);
  }

  assert.deepEqual(policies.map(({ academicTerm, minimumElectives, maximumElectives }) => ({ position: academicTerm.position, minimumElectives, maximumElectives })), [
    { position: 1, minimumElectives: 1, maximumElectives: 1 },
    { position: 2, minimumElectives: 1, maximumElectives: 1 },
    { position: 3, minimumElectives: 0, maximumElectives: 0 },
  ]);
  assert.equal(offerings.some((offering) => offering.terms.some((term) => term.academicTerm.position === 3)), false);
});
