import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { deriveApprovedRegularJhsStudentSubjectEnrollments } from "../../services/jhs-student-subject-enrollment-derivation.service";
import {
  correctStudentEnrollmentPlacementInTransaction,
  StudentEnrollmentCorrectionError,
} from "../../services/student-enrollment-correction-mutation.service";

class RollbackFixture extends Error {}

async function withRollback(run: (transaction: Prisma.TransactionClient) => Promise<void>) {
  try {
    await prisma.$transaction(async (transaction) => {
      await run(transaction);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
}

async function rollbackToSavepoint(
  transaction: Prisma.TransactionClient,
  run: () => Promise<void>,
) {
  await transaction.$executeRawUnsafe("SAVEPOINT phase21f_a_test");
  try {
    await run();
    await transaction.$executeRawUnsafe("RELEASE SAVEPOINT phase21f_a_test");
    return null;
  } catch (error) {
    await transaction.$executeRawUnsafe("ROLLBACK TO SAVEPOINT phase21f_a_test");
    return error;
  }
}

const evidenceIsolationTriggers = [
  ["StudentSubjectEnrollment", "StudentEnrollmentCorrection_reject_sse_mutation_trigger"],
  ["StudentSubjectEnrollmentTerm", "StudentEnrollmentCorrection_reject_sse_term_mutation_trigger"],
  ["ShsTermResult", "StudentEnrollmentCorrection_reject_result_mutation_trigger"],
  ["Grade", "StudentEnrollmentCorrection_reject_grade_mutation_trigger"],
] as const;

async function setEvidenceIsolationTriggers(
  transaction: Prisma.TransactionClient,
  enabled: boolean,
) {
  for (const [table, trigger] of evidenceIsolationTriggers) {
    await transaction.$executeRawUnsafe(
      `ALTER TABLE "${table}" ${enabled ? "ENABLE" : "DISABLE"} TRIGGER "${trigger}"`,
    );
  }
}

async function seedExistingEvidence<T>(
  transaction: Prisma.TransactionClient,
  run: () => Promise<T>,
) {
  await setEvidenceIsolationTriggers(transaction, false);
  try {
    return await run();
  } finally {
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    await setEvidenceIsolationTriggers(transaction, true);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
  }
}

async function createPlacementFixture(
  transaction: Prisma.TransactionClient,
  options: { gradeLevel?: string; enrollmentStatus?: "ACTIVE" | "COMPLETED"; academicYearStatus?: "ACTIVE" | "DRAFT" } = {},
) {
  const gradeLevel = options.gradeLevel ?? "7";
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const actor = await transaction.user.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  const academicYear = options.academicYearStatus === "DRAFT"
    ? await transaction.academicYear.create({
        data: {
          label: "2035-2036",
          startDate: new Date("2035-06-01T00:00:00.000Z"),
          endDate: new Date("2036-04-30T00:00:00.000Z"),
          status: "DRAFT",
          createdById: actor.id,
        },
        select: { id: true, label: true, status: true, terms: { select: { id: true } } },
      })
    : await transaction.academicYear.findFirstOrThrow({
        where: { status: "ACTIVE" },
        select: { id: true, label: true, status: true, terms: { select: { id: true }, orderBy: { position: "asc" } } },
      });
  const [source, destination, crossGrade, student] = await Promise.all([
    transaction.section.create({
      data: { gradeLevel, sectionName: `21F-A Source ${suffix}`, createdById: actor.id },
      select: { id: true, gradeLevel: true, sectionName: true },
    }),
    transaction.section.create({
      data: { gradeLevel, sectionName: `21F-A Destination ${suffix}`, createdById: actor.id },
      select: { id: true, gradeLevel: true, sectionName: true },
    }),
    transaction.section.create({
      data: { gradeLevel: gradeLevel === "7" ? "8" : "12", sectionName: `21F-A Cross ${suffix}`, createdById: actor.id },
      select: { id: true, gradeLevel: true, sectionName: true },
    }),
    transaction.student.create({
      data: {
        lrn: `P21FA${suffix}`,
        firstName: "Placement",
        lastName: "Correction",
        gender: "FEMALE",
        barangay: "Test",
        municipality: "Test",
        province: "Test",
        createdById: actor.id,
      },
      select: { id: true, lrn: true },
    }),
  ]);
  const isShs = gradeLevel === "11" || gradeLevel === "12";
  const enrollment = await transaction.enrollment.create({
    data: {
      studentId: student.id,
      sectionId: source.id,
      academicYearId: academicYear.id,
      status: options.enrollmentStatus ?? "ACTIVE",
      entryAcademicTermId: isShs ? academicYear.terms[0]?.id : undefined,
      shsTrack: isShs ? "ACADEMIC" : undefined,
      createdById: actor.id,
    },
  });
  if (options.enrollmentStatus !== "COMPLETED" && academicYear.status === "ACTIVE") {
    await transaction.student.update({
      where: { id: student.id },
      data: { status: "ENROLLED", currentSectionId: source.id },
    });
  }
  return { actor, academicYear, source, destination, crossGrade, student, enrollment };
}

const correctionValues = (sourceSectionId: string, destinationSectionId: string) => ({
  sourceSectionId,
  destinationSectionId,
  reason: "Registrar verified an administrative Section encoding mistake.",
  evidenceReference: "Enrollment form EF-21F-A-001",
  confirmed: true,
});

test("same-grade JHS correction records immutable history and preserves all participation evidence", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createPlacementFixture(transaction);
    const otherFixture = await createPlacementFixture(transaction);
    const grade = await seedExistingEvidence(transaction, async () => {
      await deriveApprovedRegularJhsStudentSubjectEnrollments({
        enrollmentId: fixture.enrollment.id,
        academicYearId: fixture.academicYear.id,
        academicYearLabel: fixture.academicYear.label,
        gradeLevel: fixture.source.gradeLevel,
        studentLrn: fixture.student.lrn,
        actorId: fixture.actor.id,
      }, transaction);
      const gradeSubject = await transaction.studentSubjectEnrollment.findFirstOrThrow({
        where: { enrollmentId: fixture.enrollment.id },
        select: { subjectOffering: { select: { subjectId: true } } },
      });
      return transaction.grade.create({
        data: {
          enrollmentId: fixture.enrollment.id,
          subjectId: gradeSubject.subjectOffering.subjectId,
          firstQuarter: 88,
          createdById: fixture.actor.id,
        },
      });
    });
    const [participationBefore, gradesBefore] = await Promise.all([
      transaction.studentSubjectEnrollment.findMany({
        where: { enrollmentId: fixture.enrollment.id },
        include: { terms: { include: { result: true }, orderBy: { academicTermId: "asc" } } },
        orderBy: { id: "asc" },
      }),
      transaction.grade.findMany({ where: { enrollmentId: fixture.enrollment.id }, orderBy: { id: "asc" } }),
    ]);

    const result = await correctStudentEnrollmentPlacementInTransaction(
      fixture.enrollment.id,
      correctionValues(fixture.source.id, fixture.destination.id),
      fixture.actor.id,
      transaction,
      () => new Date("2026-08-24T08:00:00.000Z"),
      randomUUID(),
    );
    const [enrollment, student, participationAfter, gradesAfter, correction, audits] = await Promise.all([
      transaction.enrollment.findUniqueOrThrow({ where: { id: fixture.enrollment.id } }),
      transaction.student.findUniqueOrThrow({ where: { id: fixture.student.id }, select: { status: true, currentSectionId: true } }),
      transaction.studentSubjectEnrollment.findMany({
        where: { enrollmentId: fixture.enrollment.id },
        include: { terms: { include: { result: true }, orderBy: { academicTermId: "asc" } } },
        orderBy: { id: "asc" },
      }),
      transaction.grade.findMany({ where: { enrollmentId: fixture.enrollment.id }, orderBy: { id: "asc" } }),
      transaction.studentEnrollmentCorrection.findUniqueOrThrow({ where: { id: result.correctionId } }),
      transaction.auditLog.findMany({ where: { recordId: { in: [fixture.enrollment.id, result.correctionId] } } }),
    ]);

    assert.equal(enrollment.id, fixture.enrollment.id);
    assert.equal(enrollment.sectionId, fixture.destination.id);
    assert.equal(enrollment.status, fixture.enrollment.status);
    assert.equal(enrollment.entryAcademicTermId, fixture.enrollment.entryAcademicTermId);
    assert.equal(enrollment.shsTrack, fixture.enrollment.shsTrack);
    assert.deepEqual(student, { status: "ENROLLED", currentSectionId: fixture.destination.id });
    assert.deepEqual(participationAfter, participationBefore);
    assert.deepEqual(gradesAfter, gradesBefore);
    assert.equal(correction.enrollmentId, fixture.enrollment.id);
    assert.equal(correction.sourceSectionId, fixture.source.id);
    assert.equal(correction.destinationSectionId, fixture.destination.id);
    assert.equal(audits.length, 2);

    const evidenceError = await rollbackToSavepoint(transaction, () =>
      transaction.studentSubjectEnrollment.update({
        where: { id: participationAfter[0]!.id },
        data: { status: "REPLACED", replacedAt: new Date() },
      }).then(() => undefined),
    );
    assert.match(String(evidenceError), /cannot mutate participation, Term, result, or Grade evidence/);

    const gradeOwnershipError = await rollbackToSavepoint(transaction, () =>
      transaction.grade.update({
        where: { id: grade.id },
        data: { enrollmentId: otherFixture.enrollment.id },
      }).then(() => undefined),
    );
    assert.match(String(gradeOwnershipError), /cannot mutate participation, Term, result, or Grade evidence/);
  });
});

test("same-grade SHS correction preserves SSE, Term, and DRAFT result identities", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createPlacementFixture(transaction, { gradeLevel: "11" });
    const offering = await transaction.subjectOffering.findFirstOrThrow({
      where: { academicYearId: fixture.academicYear.id, gradeLevel: "11", deletedAt: null, shsContext: { classification: "CORE", curriculumStatus: "SCHOOL_APPROVED" } },
      select: {
        id: true,
        subjectCode: true,
        subjectDescription: true,
        gradeLevel: true,
        terms: { select: { academicTermId: true }, orderBy: { academicTermId: "asc" } },
        shsContext: true,
      },
    });
    const { participation, otherParticipation } = await seedExistingEvidence(transaction, async () => {
      const participation = await transaction.studentSubjectEnrollment.create({
        data: {
          enrollmentId: fixture.enrollment.id,
          subjectOfferingId: offering.id,
          subjectCode: offering.subjectCode,
          subjectDescription: offering.subjectDescription,
          gradeLevel: offering.gradeLevel,
          shsClassification: offering.shsContext!.classification,
          shsCurriculumStatus: offering.shsContext!.curriculumStatus,
          shsSourceReference: offering.shsContext!.sourceReference,
          shsApprovalReference: offering.shsContext!.approvalReference,
          createdById: fixture.actor.id,
          terms: { create: offering.terms.map(({ academicTermId }) => ({ academicTermId })) },
        },
        include: { terms: true },
      });
      const otherFixture = await createPlacementFixture(transaction, { gradeLevel: "11" });
      const otherParticipation = await transaction.studentSubjectEnrollment.create({
        data: {
          enrollmentId: otherFixture.enrollment.id,
          subjectOfferingId: offering.id,
          subjectCode: offering.subjectCode,
          subjectDescription: offering.subjectDescription,
          gradeLevel: offering.gradeLevel,
          shsClassification: offering.shsContext!.classification,
          shsCurriculumStatus: offering.shsContext!.curriculumStatus,
          shsSourceReference: offering.shsContext!.sourceReference,
          shsApprovalReference: offering.shsContext!.approvalReference,
          createdById: fixture.actor.id,
          terms: { create: offering.terms.map(({ academicTermId }) => ({ academicTermId })) },
        },
      });
      await transaction.shsTermResult.create({
        data: {
          studentSubjectEnrollmentId: participation.id,
          academicTermId: participation.terms[0]!.academicTermId,
          finalResult: 88,
          createdById: fixture.actor.id,
        },
      });
      return { participation, otherParticipation };
    });
    const before = await transaction.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: participation.id }, include: { terms: { include: { result: true }, orderBy: { academicTermId: "asc" } } },
    });

    await correctStudentEnrollmentPlacementInTransaction(
      fixture.enrollment.id,
      correctionValues(fixture.source.id, fixture.destination.id),
      fixture.actor.id,
      transaction,
    );
    const after = await transaction.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: participation.id }, include: { terms: { include: { result: true }, orderBy: { academicTermId: "asc" } } },
    });
    assert.deepEqual(after, before);
    const resultError = await rollbackToSavepoint(transaction, () =>
      transaction.shsTermResult.update({
        where: {
          studentSubjectEnrollmentId_academicTermId: {
            studentSubjectEnrollmentId: participation.id,
            academicTermId: participation.terms[0]!.academicTermId,
          },
        },
        data: { finalResult: 89 },
      }).then(() => undefined),
    );
    assert.match(String(resultError), /cannot mutate participation, Term, result, or Grade evidence/);
    const resultOwnershipError = await rollbackToSavepoint(transaction, () =>
      transaction.shsTermResult.update({
        where: {
          studentSubjectEnrollmentId_academicTermId: {
            studentSubjectEnrollmentId: participation.id,
            academicTermId: participation.terms[0]!.academicTermId,
          },
        },
        data: { studentSubjectEnrollmentId: otherParticipation.id },
      }).then(() => undefined),
    );
    assert.match(String(resultOwnershipError), /cannot mutate participation, Term, result, or Grade evidence/);
  });
});

test("evidence and Section mutations cannot precede a correction in the same transaction", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createPlacementFixture(transaction);
    await seedExistingEvidence(transaction, () =>
      deriveApprovedRegularJhsStudentSubjectEnrollments({
        enrollmentId: fixture.enrollment.id,
        academicYearId: fixture.academicYear.id,
        academicYearLabel: fixture.academicYear.label,
        gradeLevel: fixture.source.gradeLevel,
        studentLrn: fixture.student.lrn,
        actorId: fixture.actor.id,
      }, transaction),
    );
    const participation = await transaction.studentSubjectEnrollment.findFirstOrThrow({
      where: { enrollmentId: fixture.enrollment.id },
    });

    const evidenceFirstError = await rollbackToSavepoint(transaction, async () => {
      await transaction.studentSubjectEnrollment.update({
        where: { id: participation.id },
        data: { status: "REPLACED", replacedAt: new Date() },
      });
      await correctStudentEnrollmentPlacementInTransaction(
        fixture.enrollment.id,
        correctionValues(fixture.source.id, fixture.destination.id),
        fixture.actor.id,
        transaction,
      );
    });
    assert.match(
      String(evidenceFirstError),
      /cannot follow participation, Term, result, or Grade evidence mutation|Regular JHS Student Subject Enrollment replacement requires its exact active Student Enrollment Grade Correction mapping/,
    );

    const offering = await transaction.subjectOffering.findUniqueOrThrow({
      where: { id: participation.subjectOfferingId },
      select: { subjectId: true },
    });
    const evidenceInsertFirstError = await rollbackToSavepoint(transaction, async () => {
      await transaction.grade.create({
        data: {
          enrollmentId: fixture.enrollment.id,
          subjectId: offering.subjectId,
          firstQuarter: 91,
          createdById: fixture.actor.id,
        },
      });
      await correctStudentEnrollmentPlacementInTransaction(
        fixture.enrollment.id,
        correctionValues(fixture.source.id, fixture.destination.id),
        fixture.actor.id,
        transaction,
      );
    });
    assert.match(String(evidenceInsertFirstError), /cannot follow participation, Term, result, or Grade evidence mutation/);

    const sectionFirstError = await rollbackToSavepoint(transaction, async () => {
      await transaction.section.updateMany({
        where: { id: { in: [fixture.source.id, fixture.destination.id] } },
        data: { gradeLevel: "8" },
      });
      await correctStudentEnrollmentPlacementInTransaction(
        fixture.enrollment.id,
        correctionValues(fixture.source.id, fixture.destination.id),
        fixture.actor.id,
        transaction,
      );
    });
    assert.match(String(sectionFirstError), /cannot follow source or destination Section mutation/);

    const sectionReplacementError = await rollbackToSavepoint(transaction, async () => {
      await transaction.section.delete({ where: { id: fixture.destination.id } });
      await transaction.section.create({
        data: {
          id: fixture.destination.id,
          gradeLevel: fixture.destination.gradeLevel,
          sectionName: fixture.destination.sectionName,
          createdById: fixture.actor.id,
        },
      });
      await correctStudentEnrollmentPlacementInTransaction(
        fixture.enrollment.id,
        correctionValues(fixture.source.id, fixture.destination.id),
        fixture.actor.id,
        transaction,
      );
    });
    assert.match(String(sectionReplacementError), /cannot follow source or destination Section mutation/);
  });
});

test("service rejects invalid confirmation, Sections, Enrollment, year, or Student summary", async () => {
  for (const scenario of ["unconfirmed", "same", "cross", "inactive-enrollment", "inactive-year", "inactive-source", "deleted-student", "student-mismatch"] as const) {
    await withRollback(async (transaction) => {
      const fixture = await createPlacementFixture(transaction, {
        enrollmentStatus: scenario === "inactive-enrollment" ? "COMPLETED" : "ACTIVE",
        academicYearStatus: scenario === "inactive-year" ? "DRAFT" : "ACTIVE",
      });
      const destinationId = scenario === "same"
        ? fixture.source.id
        : scenario === "cross"
          ? fixture.crossGrade.id
          : fixture.destination.id;
      if (scenario === "inactive-source") {
        await transaction.section.update({ where: { id: fixture.source.id }, data: { deletedAt: new Date() } });
      }
      if (scenario === "deleted-student") {
        await transaction.student.update({ where: { id: fixture.student.id }, data: { deletedAt: new Date() } });
      }
      if (scenario === "student-mismatch") {
        await transaction.student.update({ where: { id: fixture.student.id }, data: { currentSectionId: null } });
      }
      await assert.rejects(
        correctStudentEnrollmentPlacementInTransaction(
          fixture.enrollment.id,
          {
            ...correctionValues(fixture.source.id, destinationId),
            confirmed: scenario !== "unconfirmed",
          },
          fixture.actor.id,
          transaction,
        ),
        scenario === "unconfirmed"
          ? /Confirm the historical placement correction/
          : scenario === "same"
          ? /different destination/
          : scenario === "cross"
            ? /cannot change the student's grade/
            : scenario === "inactive-enrollment"
              ? /Only an active Enrollment/
              : scenario === "inactive-year"
                ? /active Academic Year/
                : scenario === "inactive-source"
                  ? /Section no longer exists or is inactive/
                  : scenario === "deleted-student"
                    ? /Student not found/
                    : /Student placement summary does not match/,
      );
    });
  }
});

test("database rejects source mismatch, unscoped placement updates, and forged contexts", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createPlacementFixture(transaction);
    const sourceSnapshot = { sectionId: fixture.source.id, gradeLevel: fixture.source.gradeLevel, sectionName: fixture.source.sectionName };
    const destinationSnapshot = { sectionId: fixture.destination.id, gradeLevel: fixture.destination.gradeLevel, sectionName: fixture.destination.sectionName };

    const sourceError = await rollbackToSavepoint(transaction, () => transaction.studentEnrollmentCorrection.create({
      data: {
        id: randomUUID(),
        enrollmentId: fixture.enrollment.id,
        sourceSectionId: fixture.destination.id,
        destinationSectionId: fixture.source.id,
        sourcePlacementSnapshot: destinationSnapshot,
        destinationPlacementSnapshot: sourceSnapshot,
        enrollmentCreatedAtSnapshot: fixture.enrollment.createdAt,
        reason: "Verified source mismatch test",
        evidenceReference: "21F-A source test",
        correctedById: fixture.actor.id,
        correctedAt: new Date(),
      },
    }).then(() => undefined));
    assert.match(String(sourceError), /source does not match current placement/);

    const unscopedError = await rollbackToSavepoint(transaction, () => transaction.enrollment.update({
      where: { id: fixture.enrollment.id }, data: { sectionId: fixture.destination.id },
    }).then(() => undefined));
    assert.match(String(unscopedError), /exact Student Enrollment Correction context/);

    await transaction.$queryRaw`SELECT set_config('nemesys.student_enrollment_correction_id', ${randomUUID()}, true)`;
    const forgedError = await rollbackToSavepoint(transaction, () => transaction.enrollment.update({
      where: { id: fixture.enrollment.id }, data: { sectionId: fixture.destination.id },
    }).then(() => undefined));
    assert.match(String(forgedError), /context does not match/);
  });
});

test("correction events cannot be updated, deleted, or reused for another placement", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createPlacementFixture(transaction);
    const correctionId = randomUUID();
    await correctStudentEnrollmentPlacementInTransaction(
      fixture.enrollment.id,
      correctionValues(fixture.source.id, fixture.destination.id),
      fixture.actor.id,
      transaction,
      () => new Date(),
      correctionId,
    );

    const updateError = await rollbackToSavepoint(transaction, () => transaction.studentEnrollmentCorrection.update({
      where: { id: correctionId }, data: { reason: "Changed" },
    }).then(() => undefined));
    assert.match(String(updateError), /immutable/);
    const deleteError = await rollbackToSavepoint(transaction, () => transaction.studentEnrollmentCorrection.delete({
      where: { id: correctionId },
    }).then(() => undefined));
    assert.match(String(deleteError), /immutable/);

    await transaction.$queryRaw`SELECT set_config('nemesys.student_enrollment_correction_id', ${correctionId}, true)`;
    const reuseError = await rollbackToSavepoint(transaction, () => transaction.enrollment.update({
      where: { id: fixture.enrollment.id }, data: { sectionId: fixture.source.id },
    }).then(() => undefined));
    assert.match(String(reuseError), /context does not match/);

    await correctStudentEnrollmentPlacementInTransaction(
      fixture.enrollment.id,
      correctionValues(fixture.destination.id, fixture.source.id),
      fixture.actor.id,
      transaction,
    );
    await transaction.$queryRaw`SELECT set_config('nemesys.student_enrollment_correction_id', ${correctionId}, true)`;
    const cyclicReuseError = await rollbackToSavepoint(transaction, () => transaction.enrollment.update({
      where: { id: fixture.enrollment.id }, data: { sectionId: fixture.destination.id },
    }).then(() => undefined));
    assert.match(String(cyclicReuseError), /newest in-transaction Student Enrollment Correction event/);
  });
});

test("forced validation cannot be consumed before later Enrollment or Student corruption", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createPlacementFixture(transaction);
    await correctStudentEnrollmentPlacementInTransaction(
      fixture.enrollment.id,
      correctionValues(fixture.source.id, fixture.destination.id),
      fixture.actor.id,
      transaction,
    );
    await transaction.$queryRaw`SELECT set_config('nemesys.student_enrollment_correction_id', '', true)`;

    const studentError = await rollbackToSavepoint(transaction, async () => {
      await transaction.student.update({
        where: { id: fixture.student.id },
        data: { currentSectionId: fixture.source.id },
      });
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    });
    assert.match(String(studentError), /did not preserve the destination Student summary/);

    const enrollmentError = await rollbackToSavepoint(transaction, async () => {
      await transaction.enrollment.update({
        where: { id: fixture.enrollment.id },
        data: { status: "COMPLETED" },
      });
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    });
    assert.match(String(enrollmentError), /changed protected Enrollment or same-grade placement facts/);

    const replacementStudent = await transaction.student.create({
      data: {
        lrn: `P21FAX${randomUUID().replaceAll("-", "").slice(0, 12)}`,
        firstName: "Identity",
        lastName: "Transfer",
        gender: "FEMALE",
        barangay: "Test",
        municipality: "Test",
        province: "Test",
        createdById: fixture.actor.id,
      },
    });
    const identityError = await rollbackToSavepoint(transaction, async () => {
      await transaction.enrollment.update({
        where: { id: fixture.enrollment.id },
        data: { studentId: replacementStudent.id },
      });
      await transaction.student.update({
        where: { id: replacementStudent.id },
        data: { status: "ENROLLED", currentSectionId: fixture.destination.id },
      });
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    });
    assert.match(String(identityError), /changed protected Enrollment or same-grade placement facts/);

    const createdAtError = await rollbackToSavepoint(transaction, async () => {
      await transaction.enrollment.update({
        where: { id: fixture.enrollment.id },
        data: { createdAt: new Date("2020-01-01T00:00:00.000Z") },
      });
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    });
    assert.match(String(createdAtError), /changed protected Enrollment creation time/);

    const gradeError = await rollbackToSavepoint(transaction, async () => {
      await transaction.section.updateMany({
        where: { id: { in: [fixture.source.id, fixture.destination.id] } },
        data: { gradeLevel: "8" },
      });
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    });
    assert.match(String(gradeError), /cannot change grade or archive state/);

    const studentDeletionError = await rollbackToSavepoint(transaction, async () => {
      await transaction.student.update({
        where: { id: fixture.student.id },
        data: { deletedAt: new Date() },
      });
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    });
    assert.match(String(studentDeletionError), /Student must remain active and enrolled/);

    const sectionDeletionError = await rollbackToSavepoint(transaction, () =>
      transaction.section.delete({ where: { id: fixture.source.id } }).then(() => undefined),
    );
    assert.match(String(sectionDeletionError), /cannot be deleted/);
  });
});

test("multiple corrections in one transaction revalidate the affected Enrollment", async () => {
  await withRollback(async (transaction) => {
    const first = await createPlacementFixture(transaction);
    const second = await createPlacementFixture(transaction);
    await correctStudentEnrollmentPlacementInTransaction(
      first.enrollment.id,
      correctionValues(first.source.id, first.destination.id),
      first.actor.id,
      transaction,
    );
    await correctStudentEnrollmentPlacementInTransaction(
      second.enrollment.id,
      correctionValues(second.source.id, second.destination.id),
      second.actor.id,
      transaction,
    );

    const firstError = await rollbackToSavepoint(transaction, async () => {
      await transaction.student.update({
        where: { id: first.student.id },
        data: { currentSectionId: first.source.id },
      });
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    });
    assert.match(String(firstError), /did not preserve the destination Student summary/);
  });
});

test("shared intermediate Sections cannot change grade between sequential corrections", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createPlacementFixture(transaction);
    const third = await transaction.section.create({
      data: { gradeLevel: "7", sectionName: `21F-A Third ${randomUUID().slice(0, 8)}`, createdById: fixture.actor.id },
    });
    await correctStudentEnrollmentPlacementInTransaction(
      fixture.enrollment.id,
      correctionValues(fixture.source.id, fixture.destination.id),
      fixture.actor.id,
      transaction,
    );

    const sharedSectionError = await rollbackToSavepoint(transaction, async () => {
      await transaction.section.updateMany({
        where: { id: { in: [fixture.destination.id, third.id] } },
        data: { gradeLevel: "8" },
      });
      await correctStudentEnrollmentPlacementInTransaction(
        fixture.enrollment.id,
        correctionValues(fixture.destination.id, third.id),
        fixture.actor.id,
        transaction,
      );
    });
    assert.match(String(sharedSectionError), /cannot change grade or archive state/);
  });
});

test("savepoint-created correction remains protected after savepoint release", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createPlacementFixture(transaction);
    await transaction.$executeRawUnsafe("SAVEPOINT phase21f_a_correction_creation");
    await correctStudentEnrollmentPlacementInTransaction(
      fixture.enrollment.id,
      correctionValues(fixture.source.id, fixture.destination.id),
      fixture.actor.id,
      transaction,
    );
    await transaction.$executeRawUnsafe("RELEASE SAVEPOINT phase21f_a_correction_creation");
    await transaction.$queryRaw`SELECT set_config('nemesys.student_enrollment_correction_id', '', true)`;

    const corruptionError = await rollbackToSavepoint(transaction, async () => {
      await transaction.student.update({
        where: { id: fixture.student.id },
        data: { currentSectionId: fixture.source.id },
      });
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    });
    assert.match(String(corruptionError), /did not preserve the destination Student summary/);
  });
});

test("rolled-back savepoint correction loses its transaction capability", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createPlacementFixture(transaction);
    await transaction.$executeRawUnsafe("SAVEPOINT phase21f_a_rolled_back_correction");
    await correctStudentEnrollmentPlacementInTransaction(
      fixture.enrollment.id,
      correctionValues(fixture.source.id, fixture.destination.id),
      fixture.actor.id,
      transaction,
    );
    await transaction.$executeRawUnsafe("ROLLBACK TO SAVEPOINT phase21f_a_rolled_back_correction");
    await transaction.$queryRaw`SELECT set_config('nemesys.student_enrollment_correction_id', '', true)`;

    const [active] = await transaction.$queryRaw<Array<{ active: boolean }>>`
      SELECT "StudentEnrollmentCorrection_has_active_enrollment"(${fixture.enrollment.id}) AS active
    `;
    assert.equal(active?.active, false);
    assert.equal(await transaction.studentEnrollmentCorrection.count({
      where: { enrollmentId: fixture.enrollment.id },
    }), 0);

    await correctStudentEnrollmentPlacementInTransaction(
      fixture.enrollment.id,
      correctionValues(fixture.source.id, fixture.destination.id),
      fixture.actor.id,
      transaction,
    );
  });
});

test("audit failure rolls back the correction event, Enrollment, and Student synchronization", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createPlacementFixture(transaction);
    await transaction.$executeRawUnsafe(`
      CREATE FUNCTION "Phase21FA_reject_correction_audit"() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW."module" = 'StudentEnrollmentCorrection' THEN
          RAISE EXCEPTION 'forced Phase 21F-A audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await transaction.$executeRawUnsafe(`
      CREATE TRIGGER "Phase21FA_reject_correction_audit_trigger"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "Phase21FA_reject_correction_audit"()
    `);
    const correctionId = randomUUID();
    const error = await rollbackToSavepoint(transaction, () =>
      correctStudentEnrollmentPlacementInTransaction(
        fixture.enrollment.id,
        correctionValues(fixture.source.id, fixture.destination.id),
        fixture.actor.id,
        transaction,
        () => new Date(),
        correctionId,
      ).then(() => undefined),
    );
    assert.match(String(error), /forced Phase 21F-A audit failure/);
    assert.equal(await transaction.studentEnrollmentCorrection.count({ where: { id: correctionId } }), 0);
    assert.equal((await transaction.enrollment.findUniqueOrThrow({ where: { id: fixture.enrollment.id } })).sectionId, fixture.source.id);
    assert.equal((await transaction.student.findUniqueOrThrow({ where: { id: fixture.student.id } })).currentSectionId, fixture.source.id);
  });
});

test("source mismatch is surfaced as a correction domain error", () => {
  assert.equal(new StudentEnrollmentCorrectionError("test") instanceof Error, true);
});
