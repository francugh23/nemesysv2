import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { makeLegacyActiveCurriculumConfigurable } from "../helpers/phase-21e-e1-legacy-fixture";

class RollbackFixture extends Error {}

async function createFixture(transaction: Prisma.TransactionClient) {
  await makeLegacyActiveCurriculumConfigurable("academic-year-2026-2027", transaction);
  const [user, academicYear, term, jhsOffering] = await Promise.all([
    transaction.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } }),
    transaction.academicYear.findUniqueOrThrow({ where: { id: "academic-year-2026-2027" }, select: { id: true } }),
    transaction.academicTerm.findFirstOrThrow({ where: { academicYearId: "academic-year-2026-2027" }, select: { id: true } }),
    transaction.subjectOffering.findFirstOrThrow({ where: { academicYearId: "academic-year-2026-2027", gradeLevel: "7", deletedAt: null }, select: { id: true } }),
  ]);
  const suffix = randomUUID();
  const subject = await transaction.subject.create({
    data: { code: `P20A-${suffix.slice(0, 8)}`, description: "Phase 20A SHS fixture", gradeLevel: "11", createdById: user.id },
    select: { id: true, code: true, description: true },
  });
  const offering = await transaction.subjectOffering.create({
    data: { subjectId: subject.id, academicYearId: academicYear.id, gradeLevel: "11", subjectCode: subject.code, subjectDescription: subject.description, createdById: user.id, terms: { create: { academicTermId: term.id } } },
    select: { id: true },
  });
  const academicCluster = await transaction.shsCurriculumCluster.create({ data: { code: `ACA-${suffix.slice(0, 8)}`, name: "Academic fixture", track: "ACADEMIC", createdById: user.id }, select: { id: true } });
  const techProCluster = await transaction.shsCurriculumCluster.create({ data: { code: `TEC-${suffix.slice(0, 8)}`, name: "TechPro fixture", track: "TECHPRO", createdById: user.id }, select: { id: true } });
  return { user, term, offering, jhsOffering, academicCluster, techProCluster };
}

async function getCounts() {
  const [subjects, offerings, contexts, clusters, enrollments, studentSubjectEnrollments] = await Promise.all([
    prisma.subject.count(), prisma.subjectOffering.count(), prisma.subjectOfferingShsContext.count(), prisma.shsCurriculumCluster.count(), prisma.enrollment.count(), prisma.studentSubjectEnrollment.count(),
  ]);
  return { subjects, offerings, contexts, clusters, enrollments, studentSubjectEnrollments };
}

test("Phase 20A migration is additive and fixture rollback leaves existing curriculum and enrollment data unchanged", async () => {
  const before = await getCounts();
  try {
    await prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      await transaction.subjectOfferingShsContext.create({ data: { subjectOfferingId: fixture.offering.id, classification: "ACADEMIC_ELECTIVE", curriculumStatus: "SCHOOL_APPROVED", clusterId: fixture.academicCluster.id, sourceReference: "DO 017", approvalReference: "School approval fixture", approvedById: fixture.user.id, approvedAt: new Date(), createdById: fixture.user.id } });
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
  assert.deepEqual(await getCounts(), before);
});

test("Phase 20A database constraints reject invalid SHS context combinations", async () => {
  await assert.rejects(prisma.$transaction(async (transaction) => {
    const fixture = await createFixture(transaction);
    await transaction.subjectOfferingShsContext.create({ data: { subjectOfferingId: fixture.jhsOffering.id, classification: "CORE", curriculumStatus: "PROVISIONAL_DEPED", sourceReference: "DO 017", createdById: fixture.user.id } });
  }), /Grade 11 or 12/i);

  await assert.rejects(prisma.$transaction(async (transaction) => {
    const fixture = await createFixture(transaction);
    await transaction.subjectOfferingShsContext.create({ data: { subjectOfferingId: fixture.offering.id, classification: "CORE", curriculumStatus: "PROVISIONAL_DEPED", clusterId: fixture.academicCluster.id, sourceReference: "DO 017", createdById: fixture.user.id } });
  }), /cannot have a curriculum cluster/i);

  await assert.rejects(prisma.$transaction(async (transaction) => {
    const fixture = await createFixture(transaction);
    await transaction.subjectOfferingShsContext.create({ data: { subjectOfferingId: fixture.offering.id, classification: "ACADEMIC_ELECTIVE", curriculumStatus: "SCHOOL_APPROVED", clusterId: fixture.techProCluster.id, sourceReference: "DO 017", approvalReference: "School approval", approvedById: fixture.user.id, approvedAt: new Date(), createdById: fixture.user.id } });
  }), /Academic curriculum cluster/i);

  await assert.rejects(prisma.$transaction(async (transaction) => {
    const fixture = await createFixture(transaction);
    await transaction.subjectOfferingShsContext.create({ data: { subjectOfferingId: fixture.offering.id, classification: "TECHPRO_ELECTIVE", curriculumStatus: "PROVISIONAL_DEPED", clusterId: fixture.techProCluster.id, createdById: fixture.user.id } });
  }), /SubjectOfferingShsContext_provenance_check/i);
});

test("provisional SHS Offerings cannot materialize Student Subject Enrollments", async () => {
  await assert.rejects(prisma.$transaction(async (transaction) => {
    const fixture = await createFixture(transaction);
    await transaction.subjectOfferingShsContext.create({ data: { subjectOfferingId: fixture.offering.id, classification: "CORE", curriculumStatus: "PROVISIONAL_DEPED", sourceReference: "DO 017", createdById: fixture.user.id } });
    const section = await transaction.section.create({ data: { gradeLevel: "11", sectionName: `P20A ${randomUUID()}`, createdById: fixture.user.id }, select: { id: true } });
    const student = await transaction.student.create({ data: { lrn: `P20A${randomUUID().replaceAll("-", "").slice(0, 12)}`, firstName: "Phase", lastName: "Twenty", gender: "FEMALE", barangay: "Test", municipality: "Test", province: "Test", createdById: fixture.user.id }, select: { id: true } });
    const enrollment = await transaction.enrollment.create({ data: { studentId: student.id, sectionId: section.id, academicYearId: "academic-year-2026-2027", entryAcademicTermId: fixture.term.id, shsTrack: "ACADEMIC", createdById: fixture.user.id }, select: { id: true } });
    await transaction.studentSubjectEnrollment.create({ data: { enrollmentId: enrollment.id, subjectOfferingId: fixture.offering.id, subjectCode: "P20A", subjectDescription: "Provisional", gradeLevel: "11", createdById: fixture.user.id } });
  }), /Provisional DepEd Subject Offerings cannot materialize/i);
});

test("approved SHS Offering context is frozen once Student Participation exists", async () => {
  await assert.rejects(prisma.$transaction(async (transaction) => {
      const fixture = await createFixture(transaction);
      await transaction.subjectOfferingShsContext.create({ data: { subjectOfferingId: fixture.offering.id, classification: "ACADEMIC_ELECTIVE", curriculumStatus: "SCHOOL_APPROVED", clusterId: fixture.academicCluster.id, sourceReference: "DO 017", approvalReference: "School approval 1", approvedById: fixture.user.id, approvedAt: new Date(), createdById: fixture.user.id } });
      const section = await transaction.section.create({ data: { gradeLevel: "11", sectionName: `P20A ${randomUUID()}`, createdById: fixture.user.id }, select: { id: true } });
      const student = await transaction.student.create({ data: { lrn: `P20A${randomUUID().replaceAll("-", "").slice(0, 12)}`, firstName: "Phase", lastName: "Twenty", gender: "FEMALE", barangay: "Test", municipality: "Test", province: "Test", createdById: fixture.user.id }, select: { id: true } });
      const enrollment = await transaction.enrollment.create({ data: { studentId: student.id, sectionId: section.id, academicYearId: "academic-year-2026-2027", entryAcademicTermId: fixture.term.id, shsTrack: "ACADEMIC", createdById: fixture.user.id }, select: { id: true } });
      const studentSubjectEnrollment = await transaction.studentSubjectEnrollment.create({ data: { enrollmentId: enrollment.id, subjectOfferingId: fixture.offering.id, subjectCode: "P20A", subjectDescription: "Approved", gradeLevel: "11", shsClassification: "ACADEMIC_ELECTIVE", shsClusterCode: (await transaction.shsCurriculumCluster.findUniqueOrThrow({ where: { id: fixture.academicCluster.id }, select: { code: true } })).code, shsClusterName: "Academic fixture", shsCurriculumStatus: "SCHOOL_APPROVED", shsSourceReference: "DO 017", shsApprovalReference: "School approval 1", createdById: fixture.user.id } });
      await transaction.subjectOfferingShsContext.update({ where: { subjectOfferingId: fixture.offering.id }, data: { approvalReference: "School approval 2" } });
      await transaction.studentSubjectEnrollment.update({ where: { id: studentSubjectEnrollment.id }, data: { status: "REPLACED", replacedAt: new Date() } });
      await transaction.studentSubjectEnrollment.update({ where: { id: studentSubjectEnrollment.id }, data: { shsClusterName: "Changed" } });
    }), /SHS Curriculum context used by student participation cannot be changed/i);
});
