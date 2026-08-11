import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";
import { populateProvisionalDepedReferenceCatalog } from "../../services/deped-reference-catalog.service";

async function safetySnapshot() {
  const [jhsSubjects, jhsOfferings, studentSubjectEnrollments, enrollments, assignments, grades] = await Promise.all([
    prisma.subject.findMany({ where: { deletedAt: null, gradeLevel: { in: ["7", "8", "9", "10"] } }, select: { code: true, description: true, gradeLevel: true, updatedAt: true }, orderBy: { code: "asc" } }),
    prisma.subjectOffering.findMany({ where: { deletedAt: null, gradeLevel: { in: ["7", "8", "9", "10"] } }, select: { id: true, subjectId: true, academicYearId: true, gradeLevel: true, subjectCode: true, subjectDescription: true, updatedAt: true, terms: { select: { academicTermId: true }, orderBy: { academicTermId: "asc" } } }, orderBy: { subjectCode: "asc" } }),
    prisma.studentSubjectEnrollment.findMany({ select: { id: true, enrollmentId: true, subjectOfferingId: true, subjectCode: true, gradeLevel: true, status: true, updatedAt: true }, orderBy: { id: "asc" } }),
    prisma.enrollment.findMany({ where: { deletedAt: null }, select: { id: true, studentId: true, sectionId: true, academicYearId: true, status: true, updatedAt: true }, orderBy: { id: "asc" } }),
    prisma.subjectAssignment.findMany({ where: { deletedAt: null }, select: { id: true, subjectId: true, teacherId: true, sectionId: true, academicYearId: true, updatedAt: true }, orderBy: { id: "asc" } }),
    prisma.grade.findMany({ where: { deletedAt: null }, select: { id: true, enrollmentId: true, subjectId: true, updatedAt: true }, orderBy: { id: "asc" } }),
  ]);
  return { jhsSubjects, jhsOfferings, studentSubjectEnrollments, enrollments, assignments, grades };
}

test("Phase 20B catalog remains source-backed and term-safe across the approval lifecycle", async () => {
  const [clusters, references, offerings] = await Promise.all([
    prisma.shsCurriculumCluster.findMany({ where: { deletedAt: null }, select: { code: true, sourceReference: true } }),
    prisma.shsCurriculumReference.findMany({ select: { gradeLevel: true, classification: true, curriculumStatus: true, sourceReference: true, termApplicability: true, cluster: { select: { track: true } } } }),
    prisma.subjectOffering.findMany({
      where: { deletedAt: null, gradeLevel: { in: ["11", "12"] } },
      select: {
        academicYearId: true,
        terms: { select: { academicTerm: { select: { academicYearId: true } } } },
        shsContext: { select: { classification: true, curriculumStatus: true, sourceReference: true, approvalReference: true, approvedById: true, approvedAt: true, cluster: { select: { track: true } } } },
      },
    }),
  ]);

  assert.equal(clusters.length, 15);
  assert.ok(clusters.every((cluster) => cluster.sourceReference?.includes("deped.gov.ph")));
  assert.equal(references.length, 171);
  assert.ok(references.every((reference) => reference.curriculumStatus === "PROVISIONAL_DEPED" && reference.sourceReference.includes("deped.gov.ph") && ["11", "12"].includes(reference.gradeLevel)));
  assert.ok(references.filter((reference) => reference.classification === "CORE").every((reference) => reference.cluster === null));
  assert.ok(references.filter((reference) => reference.classification === "ACADEMIC_ELECTIVE").every((reference) => reference.cluster?.track === "ACADEMIC"));
  assert.ok(references.filter((reference) => reference.classification === "TECHPRO_ELECTIVE").every((reference) => reference.cluster?.track === "TECHPRO"));
  assert.ok(references.filter((reference) => reference.classification === "ACADEMIC_ELECTIVE").every((reference) => reference.termApplicability === "UNSPECIFIED"));
  assert.equal(offerings.length, 94);
  assert.ok(offerings.every((offering) => offering.academicYearId === "academic-year-2026-2027" && offering.terms.length === 3 && offering.terms.every((term) => term.academicTerm.academicYearId === offering.academicYearId)));
  assert.ok(offerings.every((offering) => {
    const context = offering.shsContext;

    if (!context?.sourceReference?.includes("deped.gov.ph")) return false;

    return context.curriculumStatus === "PROVISIONAL_DEPED"
      ? context.approvalReference === null && context.approvedById === null && context.approvedAt === null
      : Boolean(context.approvalReference?.trim() && context.approvedById && context.approvedAt);
  }));
});

test("Phase 20B population is idempotent and preserves JHS and operational records", async () => {
  const actor = await prisma.user.findFirstOrThrow({ where: { deletedAt: null, status: "ACTIVE" }, select: { id: true } });
  const before = await safetySnapshot();
  const result = await populateProvisionalDepedReferenceCatalog(actor.id);
  assert.deepEqual(result, { createdClusters: 0, createdSubjects: 0, createdReferences: 0, createdOfferings: 0 });
  assert.deepEqual(await safetySnapshot(), before);
});

test("Phase 20B references reject missing provenance and invalid cluster classification", async () => {
  await assert.rejects(prisma.$transaction(async (tx) => {
    const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
    const subject = await tx.subject.create({ data: { code: "P20B-NO-SOURCE", description: "Phase 20B invalid fixture", gradeLevel: "11", createdById: actor.id } });
    await tx.shsCurriculumReference.create({ data: { subjectId: subject.id, gradeLevel: "11", classification: "CORE", curriculumStatus: "PROVISIONAL_DEPED", sourceReference: " ", termApplicability: "ALL_CONFIGURED_TERMS", createdById: actor.id } });
  }), /ShsCurriculumReference_provisional_check/i);

  await assert.rejects(prisma.$transaction(async (tx) => {
    const [actor, academicCluster] = await Promise.all([
      tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } }),
      tx.shsCurriculumCluster.findFirstOrThrow({ where: { track: "ACADEMIC", deletedAt: null }, select: { id: true } }),
    ]);
    const subject = await tx.subject.create({ data: { code: "P20B-BAD-TRACK", description: "Phase 20B invalid fixture", gradeLevel: "11", createdById: actor.id } });
    await tx.shsCurriculumReference.create({ data: { subjectId: subject.id, gradeLevel: "11", classification: "TECHPRO_ELECTIVE", curriculumStatus: "PROVISIONAL_DEPED", clusterId: academicCluster.id, sourceReference: "https://www.deped.gov.ph/strengthened-shs-program/", termApplicability: "ALL_CONFIGURED_TERMS", createdById: actor.id } });
  }), /TechPro elective curriculum references require a TechPro curriculum cluster/i);
});
