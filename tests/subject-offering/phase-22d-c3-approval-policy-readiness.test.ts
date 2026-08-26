import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";
import { findAcademicYearConfigurationById } from "../../repositories/academic-year.repository";
import { countPendingShsOfferings } from "../../repositories/curriculum-finalization.repository";
import {
  countCurriculumCorrections,
  countOfferings,
  findAcademicYearOfferingGradeCounts,
} from "../../repositories/subject-offering.repository";
import { findShsElectiveEnrollmentPolicies } from "../../repositories/shs-elective-enrollment-policy.repository";
import { buildAcademicYearConfigurationSummary } from "../../services/academic-year-configuration-summary.service";

const coreCodes = [
  "SSHS-G11-CORE-01",
  "SSHS-G11-CORE-02",
  "SSHS-G11-CORE-03",
  "SSHS-G11-CORE-04",
  "SSHS-G11-CORE-05",
] as const;

const expectedElectivesByTerm = new Map([
  [1, ["SSHS-G11-ASSH-CL1", "SSHS-G11-STEM-BIO1", "SSHS-G11-CADT-VGD", "SSHS-G11-HT-FBO"]],
  [2, ["SSHS-G11-ASSH-CL2", "SSHS-G11-STEM-BIO2", "SSHS-G11-CADT-VGD", "SSHS-G11-HT-FBO"]],
  [3, ["SSHS-G11-CADT-VGD", "SSHS-G11-HT-FBO"]],
]);

test("2026-2027 Grade 11 C3-A approvals and elective policies are demo-ready without Grade 12 setup", async () => {
  const academicYear = await prisma.academicYear.findFirstOrThrow({
    where: { label: "2026-2027", status: "ACTIVE" },
    select: {
      id: true,
      terms: {
        select: { id: true, position: true },
        orderBy: { position: "asc" },
      },
    },
  });
  const [grade11Offerings, policies, approvalAudits, policyAudits, zeroState] = await Promise.all([
    prisma.subjectOffering.findMany({
      where: {
        academicYearId: academicYear.id,
        gradeLevel: "11",
        deletedAt: null,
        shsContext: { isNot: null },
      },
      select: {
        subjectCode: true,
        terms: {
          select: { academicTerm: { select: { position: true } } },
          orderBy: { academicTerm: { position: "asc" } },
        },
        shsContext: {
          select: {
            classification: true,
            curriculumStatus: true,
            clusterId: true,
            sourceReference: true,
            approvalReference: true,
            approvedById: true,
            approvedAt: true,
          },
        },
      },
      orderBy: { subjectCode: "asc" },
    }),
    prisma.shsElectiveEnrollmentPolicy.findMany({
      where: { academicYearId: academicYear.id, gradeLevel: "11" },
      select: {
        academicTerm: { select: { position: true } },
        minimumElectives: true,
        maximumElectives: true,
      },
      orderBy: { academicTerm: { position: "asc" } },
    }),
    prisma.auditLog.count({
      where: {
        module: "SubjectOffering",
        action: "UPDATE",
        recordName: { in: coreCodes.map((code) => `${code} - 2026-2027`) },
        description: "Approved SSHS subject offering for school use.",
      },
    }),
    prisma.auditLog.count({
      where: {
        module: "ShsElectiveEnrollmentPolicy",
        action: "CREATE",
        recordName: { in: ["Grade 11 - Term 1", "Grade 11 - Term 2", "Grade 11 - Term 3"] },
        description: "Created SHS elective enrollment policy.",
      },
    }),
    Promise.all([
      prisma.subject.count({ where: { gradeLevel: "12", deletedAt: null } }),
      prisma.subjectOffering.count({
        where: { academicYearId: academicYear.id, gradeLevel: "12", deletedAt: null },
      }),
      prisma.shsElectiveEnrollmentPolicy.count({
        where: { academicYearId: academicYear.id, gradeLevel: "12" },
      }),
      prisma.teacher.count({ where: { deletedAt: null } }),
      prisma.student.count({ where: { deletedAt: null } }),
      prisma.enrollment.count(),
      prisma.studentSubjectEnrollment.count(),
      prisma.shsTermResult.count(),
      prisma.shsTermResultRevision.count(),
      prisma.grade.count(),
      prisma.studentEnrollmentCorrection.count(),
      prisma.studentEnrollmentGradeCorrection.count(),
      prisma.studentParticipationCorrection.count(),
      prisma.shsStudentParticipationCorrection.count(),
      prisma.curriculumCorrection.count(),
      prisma.curriculumFinalization.count(),
    ]),
  ]);

  const cores = grade11Offerings.filter(
    ({ shsContext }) => shsContext?.classification === "CORE",
  );
  const electives = grade11Offerings.filter(
    ({ shsContext }) =>
      shsContext?.classification === "ACADEMIC_ELECTIVE" ||
      shsContext?.classification === "TECHPRO_ELECTIVE",
  );

  assert.equal(grade11Offerings.length, 11);
  assert.equal(cores.length, 5);
  assert.equal(electives.length, 6);
  assert.equal(approvalAudits, 5);
  assert.equal(policyAudits, 3);

  for (const code of coreCodes) {
    const core = cores.find((offering) => offering.subjectCode === code);
    assert.ok(core);
    assert.deepEqual(
      core.terms.map(({ academicTerm }) => academicTerm.position),
      [1, 2, 3],
    );
    assert.equal(core.shsContext?.curriculumStatus, "SCHOOL_APPROVED");
    assert.equal(core.shsContext?.clusterId, null);
    assert.ok(core.shsContext?.sourceReference?.includes("deped.gov.ph"));
    assert.equal(core.shsContext?.approvalReference, `DEMO-BOT-AY2026-2027-${code}`);
    assert.ok(core.shsContext?.approvedById);
    assert.ok(core.shsContext?.approvedAt);
  }

  for (const [position, codes] of expectedElectivesByTerm) {
    const eligibleCodes = electives
      .filter(
        (offering) =>
          offering.shsContext?.curriculumStatus === "SCHOOL_APPROVED" &&
          offering.terms.some(({ academicTerm }) => academicTerm.position === position),
      )
      .map(({ subjectCode }) => subjectCode)
      .sort();
    assert.deepEqual(eligibleCodes, [...codes].sort());
  }

  assert.deepEqual(
    policies.map((policy) => ({
      position: policy.academicTerm.position,
      minimumElectives: policy.minimumElectives,
      maximumElectives: policy.maximumElectives,
    })),
    [
      { position: 1, minimumElectives: 1, maximumElectives: 1 },
      { position: 2, minimumElectives: 1, maximumElectives: 1 },
      { position: 3, minimumElectives: 1, maximumElectives: 1 },
    ],
  );
  assert.deepEqual(zeroState, Array(16).fill(0));

  const readiness = await prisma.$transaction(async (transaction) => {
    const configuration = await findAcademicYearConfigurationById(
      academicYear.id,
      transaction,
    );
    assert.ok(configuration);
    const [
      activeOfferingCount,
      gradeCounts,
      provisionalShsOfferingCount,
      pendingShsOfferingCount,
      schoolApprovedShsOfferingCount,
      controlledCorrectionCount,
      electivePolicies,
    ] = await Promise.all([
      countOfferings({ academicYearId: academicYear.id }, transaction),
      findAcademicYearOfferingGradeCounts(academicYear.id, transaction),
      countOfferings(
        { academicYearId: academicYear.id, curriculumStatus: "PROVISIONAL_DEPED" },
        transaction,
      ),
      countPendingShsOfferings(academicYear.id, transaction),
      countOfferings(
        { academicYearId: academicYear.id, curriculumStatus: "SCHOOL_APPROVED" },
        transaction,
      ),
      countCurriculumCorrections(academicYear.id, transaction),
      findShsElectiveEnrollmentPolicies(academicYear.id, transaction),
    ]);
    return buildAcademicYearConfigurationSummary({
      academicYear: configuration,
      curriculum: {
        activeOfferingCount,
        gradeCounts: gradeCounts.map(({ gradeLevel, _count }) => ({
          gradeLevel,
          count: _count._all,
        })),
        provisionalShsOfferingCount,
        pendingShsOfferingCount,
        schoolApprovedShsOfferingCount,
        controlledCorrectionCount,
      },
      electivePolicies,
      includeResultPolicy: false,
    });
  });

  assert.equal(readiness.curriculum.schoolApprovedShsOfferingCount, 11);
  assert.equal(readiness.curriculum.pendingShsOfferingCount, 0);
  assert.deepEqual(readiness.electivePolicies, {
    configuredScopeCount: 3,
    totalScopeCount: 6,
    missingScopes: [
      { academicTermId: academicYear.terms[0]!.id, termName: "Term 1", termPosition: 1, gradeLevel: "12" },
      { academicTermId: academicYear.terms[1]!.id, termName: "Term 2", termPosition: 2, gradeLevel: "12" },
      { academicTermId: academicYear.terms[2]!.id, termName: "Term 3", termPosition: 3, gradeLevel: "12" },
    ],
  });
  assert.match(
    readiness.notices.find(({ code }) => code === "MISSING_ELECTIVE_POLICIES")?.message ?? "",
    /Grade 12 Term 1, Grade 12 Term 2, Grade 12 Term 3/,
  );
});
