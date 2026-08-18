import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { progressShsCurrentTermInTransaction } from "../../services/student-subject-enrollment-selection.service";

test("concurrent current-Term selections cannot exceed the elective maximum", {
  skip: process.env.B2_RUN_CONCURRENCY !== "1" ? "requires a disposable cloned database" : false,
}, async () => {
  const actor = await prisma.user.create({
    data: { username: `b2-${randomUUID()}`, email: `b2-${randomUUID()}@example.test`, passwordHash: "not-used", firstName: "B2", lastName: "Concurrency", gender: "FEMALE", role: "SUPER_ADMIN", isFirstLogin: false },
    select: { id: true },
  });
  const academicYear = await prisma.academicYear.findFirstOrThrow({
      where: { status: "ACTIVE" },
      select: { id: true, terms: { select: { id: true, startDate: true }, orderBy: { position: "asc" } } },
    });
  const currentTerm = academicYear.terms[0]!;
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const [academicCluster, techProCluster] = await Promise.all([
    prisma.shsCurriculumCluster.create({ data: { code: `B2A${suffix}`, name: "B2 Academic", track: "ACADEMIC", createdById: actor.id } }),
    prisma.shsCurriculumCluster.create({ data: { code: `B2T${suffix}`, name: "B2 TechPro", track: "TECHPRO", createdById: actor.id } }),
  ]);
  async function createOffering(code: string, classification: "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE", clusterId: string | null, termIds: string[]) {
    const subject = await prisma.subject.create({ data: { code, description: `${code} subject`, gradeLevel: "11", createdById: actor.id } });
    return prisma.subjectOffering.create({
      data: {
        subjectId: subject.id,
        academicYearId: academicYear.id,
        gradeLevel: "11",
        subjectCode: code,
        subjectDescription: subject.description,
        createdById: actor.id,
        terms: { create: termIds.map((academicTermId) => ({ academicTermId })) },
        shsContext: { create: { classification, curriculumStatus: "SCHOOL_APPROVED", clusterId, sourceReference: "B2 disposable source", approvalReference: "B2 disposable concurrency", approvedById: actor.id, approvedAt: new Date(), createdById: actor.id } },
      },
      select: { id: true },
    });
  }
  await createOffering(`B2C${suffix}`, "CORE", null, academicYear.terms.map(({ id }) => id));
  const candidates = await Promise.all([
    createOffering(`B2A${suffix}`, "ACADEMIC_ELECTIVE", academicCluster.id, [currentTerm.id]),
    createOffering(`B2T${suffix}`, "TECHPRO_ELECTIVE", techProCluster.id, [currentTerm.id]),
  ]);
  const section = await prisma.section.create({ data: { gradeLevel: "11", sectionName: `B2 concurrency ${suffix}`, createdById: actor.id } });
  const student = await prisma.student.create({ data: { lrn: `B2C${suffix}`, firstName: "Concurrent", lastName: "Selection", gender: "FEMALE", barangay: "Test", municipality: "Test", province: "Test", createdById: actor.id } });
  const enrollment = await prisma.enrollment.create({ data: { studentId: student.id, sectionId: section.id, academicYearId: academicYear.id, entryAcademicTermId: currentTerm.id, shsTrack: "ACADEMIC", createdById: actor.id } });
  await prisma.shsElectiveEnrollmentPolicy.create({ data: { academicYearId: academicYear.id, academicTermId: currentTerm.id, gradeLevel: "11", minimumElectives: 1, maximumElectives: 1, createdById: actor.id } });
  const clock = () => new Date(currentTerm.startDate.getTime() + 12 * 60 * 60 * 1000);
  const results = await Promise.allSettled(candidates.map(({ id }) => prisma.$transaction(
    (transaction) => progressShsCurrentTermInTransaction({ enrollmentId: enrollment.id, subjectOfferingIds: [id] }, actor.id, transaction, clock),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )));
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  assert.equal(results.filter(({ status }) => status === "rejected").length, 1);
  assert.equal(await prisma.studentSubjectEnrollment.count({
    where: {
      enrollmentId: enrollment.id,
      status: "ACTIVE",
      shsClassification: { in: ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"] },
      terms: { some: { academicTermId: currentTerm.id } },
    },
  }), 1);

  const racingOffering = await createOffering(`B2R${suffix}`, "ACADEMIC_ELECTIVE", academicCluster.id, [currentTerm.id]);
  const racingStudent = await prisma.student.create({ data: { lrn: `B2R${suffix}`, firstName: "Offering", lastName: "Race", gender: "FEMALE", barangay: "Test", municipality: "Test", province: "Test", createdById: actor.id } });
  const racingEnrollment = await prisma.enrollment.create({ data: { studentId: racingStudent.id, sectionId: section.id, academicYearId: academicYear.id, entryAcademicTermId: currentTerm.id, shsTrack: "ACADEMIC", createdById: actor.id } });
  let signalOfferingLocked!: () => void;
  let releaseOfferingLock!: () => void;
  const offeringLocked = new Promise<void>((resolve) => { signalOfferingLocked = resolve; });
  const release = new Promise<void>((resolve) => { releaseOfferingLock = resolve; });
  const archive = prisma.$transaction(async (transaction) => {
    await transaction.subjectOffering.update({ where: { id: racingOffering.id }, data: { deletedAt: new Date() } });
    signalOfferingLocked();
    await release;
  });
  await offeringLocked;
  const racedProgression = prisma.$transaction(
    (transaction) => progressShsCurrentTermInTransaction({ enrollmentId: racingEnrollment.id, subjectOfferingIds: [racingOffering.id] }, actor.id, transaction, clock),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  const progressionRejected = assert.rejects(racedProgression, /must remain active/);
  releaseOfferingLock();
  await archive;
  await progressionRejected;
  assert.equal(await prisma.studentSubjectEnrollment.count({ where: { enrollmentId: racingEnrollment.id } }), 0);
});
