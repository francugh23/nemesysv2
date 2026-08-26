import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { deriveApprovedRegularJhsStudentSubjectEnrollments } from "../../services/jhs-student-subject-enrollment-derivation.service";
import {
  correctStudentEnrollmentGradePlacementInTransaction,
  getGradeCorrectionTypedConfirmationPhrase,
} from "../../services/student-enrollment-grade-correction-mutation.service";
import {
  findRegularJhsGradeCorrectionDestinations,
  findSameGradePlacementDestinations,
  findStudentEnrollmentCorrectionContext,
  findStudentEnrollmentCorrectionHistory,
} from "../../repositories/student-enrollment-correction.repository";

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

let savepointSequence = 0;

async function rollbackToSavepoint(
  transaction: Prisma.TransactionClient,
  run: () => Promise<void>,
) {
  savepointSequence += 1;
  const savepoint = `phase21f_b_${savepointSequence}`;
  await transaction.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    await run();
    await transaction.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
    return null;
  } catch (error) {
    await transaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    return error;
  }
}

const evidenceTriggers = [
  ["StudentSubjectEnrollment", "StudentEnrollmentCorrection_reject_sse_mutation_trigger"],
  ["StudentSubjectEnrollmentTerm", "StudentEnrollmentCorrection_reject_sse_term_mutation_trigger"],
  ["ShsTermResult", "StudentEnrollmentCorrection_reject_result_mutation_trigger"],
  ["Grade", "StudentEnrollmentCorrection_reject_grade_mutation_trigger"],
  ["StudentSubjectEnrollment", "StudentEnrollmentGradeCorrection_reject_sse_mutation_trigger"],
  ["StudentSubjectEnrollmentTerm", "StudentEnrollmentGradeCorrection_reject_sse_term_mutation_trigger"],
  ["ShsTermResult", "StudentEnrollmentGradeCorrection_reject_result_mutation_trigger"],
  ["Grade", "StudentEnrollmentGradeCorrection_reject_grade_mutation_trigger"],
] as const;

async function setEvidenceTriggers(
  transaction: Prisma.TransactionClient,
  enabled: boolean,
  tables?: ReadonlySet<string>,
) {
  for (const [table, trigger] of evidenceTriggers) {
    if (tables && !tables.has(table)) continue;
    await transaction.$executeRawUnsafe(
      `ALTER TABLE "${table}" ${enabled ? "ENABLE" : "DISABLE"} TRIGGER "${trigger}"`,
    );
  }
}

async function seedDefensiveEvidence<T>(
  transaction: Prisma.TransactionClient,
  run: () => Promise<T>,
  tables?: ReadonlySet<string>,
  additionalTriggers: ReadonlyArray<readonly [string, string]> = [],
) {
  await setEvidenceTriggers(transaction, false, tables);
  for (const [table, trigger] of additionalTriggers) {
    await transaction.$executeRawUnsafe(`ALTER TABLE "${table}" DISABLE TRIGGER "${trigger}"`);
  }
  try {
    return await run();
  } finally {
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    for (const [table, trigger] of additionalTriggers) {
      await transaction.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE TRIGGER "${trigger}"`);
    }
    await setEvidenceTriggers(transaction, true, tables);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
  }
}

async function createSection(
  transaction: Prisma.TransactionClient,
  actorId: string,
  gradeLevel: string,
) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  return transaction.section.create({
    data: {
      gradeLevel,
      sectionName: `21F-B ${gradeLevel} ${suffix}`,
      createdById: actorId,
    },
    select: { id: true, gradeLevel: true, sectionName: true },
  });
}

async function createFixture(
  transaction: Prisma.TransactionClient,
  options: {
    sourceGrade?: string;
    destinationGrade?: string;
    enrollmentStatus?: "ACTIVE" | "COMPLETED";
    deriveSource?: boolean;
  } = {},
) {
  const sourceGrade = options.sourceGrade ?? "7";
  const destinationGrade = options.destinationGrade ?? "8";
  const actor = await transaction.user.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { id: true },
  });
  const academicYear = await transaction.academicYear.findFirstOrThrow({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      label: true,
      terms: {
        select: { id: true, startDate: true },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      },
    },
  });
  const [source, destination] = await Promise.all([
    createSection(transaction, actor.id, sourceGrade),
    createSection(transaction, actor.id, destinationGrade),
  ]);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const student = await transaction.student.create({
    data: {
      lrn: `P21FB${suffix}`,
      firstName: "Grade",
      lastName: "Correction",
      gender: "FEMALE",
      barangay: "Test",
      municipality: "Test",
      province: "Test",
      createdById: actor.id,
    },
    select: { id: true, lrn: true },
  });
  const isShs = sourceGrade === "11" || sourceGrade === "12";
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
  if (options.enrollmentStatus !== "COMPLETED") {
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    await transaction.$executeRawUnsafe(
      'ALTER TABLE "Student" DISABLE TRIGGER "StudentEnrollmentGradeCorrection_guard_student_trigger"',
    );
    try {
      await transaction.student.update({
        where: { id: student.id },
        data: { status: "ENROLLED", currentSectionId: source.id },
      });
    } finally {
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
      await transaction.$executeRawUnsafe(
        'ALTER TABLE "Student" ENABLE TRIGGER "StudentEnrollmentGradeCorrection_guard_student_trigger"',
      );
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
    }
  }
  if (options.deriveSource) {
    await seedDefensiveEvidence(transaction, () =>
      deriveApprovedRegularJhsStudentSubjectEnrollments({
        enrollmentId: enrollment.id,
        academicYearId: academicYear.id,
        academicYearLabel: academicYear.label,
        gradeLevel: source.gradeLevel,
        studentLrn: student.lrn,
        actorId: actor.id,
      }, transaction).then(() => undefined),
    );
  }
  return { actor, academicYear, source, destination, student, enrollment };
}

function correctionValues(sourceGrade: string, destinationGrade: string, sourceId: string, destinationId: string) {
  return {
    sourceSectionId: sourceId,
    destinationSectionId: destinationId,
    reason: "Registrar verified an administrative grade-level encoding mistake.",
    evidenceReference: "Enrollment form EF-21F-B-001",
    confirmed: true,
    typedConfirmation: getGradeCorrectionTypedConfirmationPhrase(sourceGrade, destinationGrade),
  };
}

function correctFixture(
  fixture: Awaited<ReturnType<typeof createFixture>>,
  transaction: Prisma.TransactionClient,
  overrides: Partial<ReturnType<typeof correctionValues>> = {},
  correctionId = randomUUID(),
) {
  return correctStudentEnrollmentGradePlacementInTransaction(
    fixture.enrollment.id,
    {
      ...correctionValues(
        fixture.source.gradeLevel,
        fixture.destination.gradeLevel,
        fixture.source.id,
        fixture.destination.id,
      ),
      ...overrides,
    },
    fixture.actor.id,
    transaction,
    () => new Date(),
    correctionId,
  );
}

async function readCorrectionContext(
  enrollmentId: string,
  transaction: Prisma.TransactionClient,
) {
  const enrollment = await findStudentEnrollmentCorrectionContext(
    enrollmentId,
    transaction,
  );
  if (!enrollment) return null;
  const [history, sameGradeDestinations, gradeLevelDestinations] = await Promise.all([
    findStudentEnrollmentCorrectionHistory(enrollmentId, transaction),
    findSameGradePlacementDestinations(
      enrollment.section.gradeLevel,
      enrollment.sectionId,
      transaction,
    ),
    findRegularJhsGradeCorrectionDestinations(
      enrollment.sectionId,
      enrollment.section.gradeLevel,
      transaction,
    ),
  ]);
  return {
    enrollment,
    history,
    destinations: [...sameGradeDestinations, ...gradeLevelDestinations],
  };
}

test("active Enrollment context returns same-grade and grade-level destinations with empty history", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction);
    const sameGradeDestination = await createSection(
      transaction,
      fixture.actor.id,
      fixture.source.gradeLevel,
    );

    const context = await readCorrectionContext(
      fixture.enrollment.id,
      transaction,
    );

    assert.ok(context);
    assert.equal(context.enrollment.id, fixture.enrollment.id);
    assert.deepEqual(context.history, []);
    assert.equal(
      context.destinations.some(({ id }) => id === fixture.destination.id),
      true,
    );
    assert.equal(
      context.destinations.some(({ id }) => id === sameGradeDestination.id),
      true,
    );
    assert.deepEqual(JSON.parse(JSON.stringify(context)).history, []);
  });
});

test("unified grade correction history is serializable and keeps participation counts", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction);
    await correctFixture(fixture, transaction);

    const context = await readCorrectionContext(
      fixture.enrollment.id,
      transaction,
    );
    assert.ok(context);
    const serialized = JSON.parse(JSON.stringify(context)) as {
      history: Array<Record<string, unknown>>;
    };

    assert.equal(context.history.length, 1);
    assert.equal(context.history[0]?.correctionType, "GRADE_LEVEL");
    assert.equal(context.history[0]?.sourceParticipationCount, 0);
    assert.equal(context.history[0]?.replacementParticipationCount, 8);
    assert.equal(typeof serialized.history[0]?.correctedAt, "string");
  });
});

test("terminal Enrollment history remains readable while missing Enrollment is rejected", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction, { enrollmentStatus: "COMPLETED" });
    const context = await readCorrectionContext(
      fixture.enrollment.id,
      transaction,
    );

    assert.ok(context);
    assert.equal(context.enrollment.id, fixture.enrollment.id);
    assert.deepEqual(context.history, []);
    assert.equal(
      await readCorrectionContext(`missing-${randomUUID()}`, transaction),
      null,
    );
  });
});

test("Grade 7 exact baseline is replaced one-to-one by Grade 8 with immutable audited history", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction, { deriveSource: true });
    const sourceBefore = await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      select: { id: true, subjectCode: true, terms: { select: { academicTermId: true } } },
      orderBy: { subjectCode: "asc" },
    });
    assert.equal(sourceBefore.length, 8);
    assert.equal(sourceBefore.flatMap(({ terms }) => terms).length, 24);

    const result = await correctFixture(fixture, transaction);
    const [enrollment, student, sourceAfter, destinationAfter, correction, children, audits] = await Promise.all([
      transaction.enrollment.findUniqueOrThrow({ where: { id: fixture.enrollment.id } }),
      transaction.student.findUniqueOrThrow({
        where: { id: fixture.student.id },
        select: { status: true, currentSectionId: true },
      }),
      transaction.studentSubjectEnrollment.findMany({
        where: { enrollmentId: fixture.enrollment.id, gradeLevel: "7" },
        include: { terms: true },
        orderBy: { subjectCode: "asc" },
      }),
      transaction.studentSubjectEnrollment.findMany({
        where: { enrollmentId: fixture.enrollment.id, gradeLevel: "8" },
        include: { terms: true },
        orderBy: { subjectCode: "asc" },
      }),
      transaction.studentEnrollmentGradeCorrection.findUniqueOrThrow({ where: { id: result.correctionId } }),
      transaction.studentParticipationCorrection.findMany({
        where: { studentEnrollmentGradeCorrectionId: result.correctionId },
        orderBy: { canonicalSubjectPrefix: "asc" },
      }),
      transaction.auditLog.findMany({
        where: {
          OR: [
            { module: "StudentEnrollmentGradeCorrection", recordId: result.correctionId },
            { module: "Enrollment", recordId: fixture.enrollment.id },
            { module: "StudentSubjectEnrollment", metadata: { path: ["correctionId"], equals: result.correctionId } },
          ],
        },
      }),
    ]);

    assert.equal(result.enrollmentId, fixture.enrollment.id);
    assert.equal(enrollment.id, fixture.enrollment.id);
    assert.equal(enrollment.sectionId, fixture.destination.id);
    assert.deepEqual(student, { status: "ENROLLED", currentSectionId: fixture.destination.id });
    assert.equal(sourceAfter.length, 8);
    assert.equal(sourceAfter.flatMap(({ terms }) => terms).length, 24);
    assert.ok(sourceAfter.every(({ status, replacedAt }) => status === "REPLACED" && replacedAt !== null));
    assert.deepEqual(sourceAfter.map(({ id }) => id).sort(), sourceBefore.map(({ id }) => id).sort());
    assert.deepEqual(
      sourceAfter.map(({ subjectCode, terms }) => ({
        subjectCode,
        termIds: terms.map(({ academicTermId }) => academicTermId).sort(),
      })),
      sourceBefore.map(({ subjectCode, terms }) => ({
        subjectCode,
        termIds: terms.map(({ academicTermId }) => academicTermId).sort(),
      })),
    );
    assert.equal(destinationAfter.length, 8);
    assert.equal(destinationAfter.flatMap(({ terms }) => terms).length, 24);
    assert.ok(destinationAfter.every(({ status }) => status === "ACTIVE"));
    assert.equal(correction.sourceParticipationCount, 8);
    assert.equal(correction.replacementParticipationCount, 8);
    assert.equal(children.length, 8);
    assert.equal(new Set(children.map(({ canonicalSubjectPrefix }) => canonicalSubjectPrefix)).size, 8);
    assert.deepEqual(
      new Set(children.map(({ sourceStudentSubjectEnrollmentId }) => sourceStudentSubjectEnrollmentId)),
      new Set(sourceAfter.map(({ id }) => id)),
    );
    assert.deepEqual(
      new Set(children.map(({ replacementStudentSubjectEnrollmentId }) => replacementStudentSubjectEnrollmentId)),
      new Set(destinationAfter.map(({ id }) => id)),
    );
    assert.equal(audits.length, 18);
    assert.equal(audits.filter(({ module, action }) => module === "StudentEnrollmentGradeCorrection" && action === "CREATE").length, 1);
    assert.equal(audits.filter(({ module, action }) => module === "Enrollment" && action === "UPDATE").length, 1);
    assert.equal(audits.filter(({ module, action }) => module === "StudentSubjectEnrollment" && action === "UPDATE").length, 8);
    assert.equal(audits.filter(({ module, action }) => module === "StudentSubjectEnrollment" && action === "CREATE").length, 8);
  });
});

test("regular JHS ACTIVE participation cannot be replaced outside the exact grade-correction capability", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction, { deriveSource: true });
    const error = await rollbackToSavepoint(transaction, () =>
      transaction.studentSubjectEnrollment.updateMany({
        where: { enrollmentId: fixture.enrollment.id, status: "ACTIVE" },
        data: { status: "REPLACED", replacedAt: new Date() },
      }).then(() => undefined),
    );

    assert.match(String(error), /requires its exact active Student Enrollment Grade Correction mapping/);
    assert.equal(await transaction.studentSubjectEnrollment.count({
      where: { enrollmentId: fixture.enrollment.id, gradeLevel: "7", status: "ACTIVE" },
    }), 8);
    assert.equal(await transaction.studentSubjectEnrollment.count({
      where: { enrollmentId: fixture.enrollment.id, status: "REPLACED" },
    }), 0);
    assert.equal(await transaction.studentEnrollmentGradeCorrection.count({
      where: { enrollmentId: fixture.enrollment.id },
    }), 0);
  });
});

test("malformed Grade 7 participation with a selection Term cannot bypass replacement capability", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction, { deriveSource: true });
    const source = await transaction.studentSubjectEnrollment.findFirstOrThrow({
      where: { enrollmentId: fixture.enrollment.id, gradeLevel: "7", status: "ACTIVE" },
      select: { id: true },
    });
    const selectionAcademicTermId = fixture.academicYear.terms[0]!.id;

    await seedDefensiveEvidence(
      transaction,
      () => transaction.studentSubjectEnrollment.update({
        where: { id: source.id },
        data: { selectionAcademicTermId },
      }).then(() => undefined),
      new Set(["StudentSubjectEnrollment"]),
      [["StudentSubjectEnrollment", "StudentSubjectEnrollment_assert_lifecycle_transition_trigger"]],
    );
    assert.equal((await transaction.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: source.id },
      select: { selectionAcademicTermId: true },
    })).selectionAcademicTermId, selectionAcademicTermId);

    const error = await rollbackToSavepoint(transaction, () =>
      transaction.studentSubjectEnrollment.update({
        where: { id: source.id },
        data: { status: "REPLACED", replacedAt: new Date() },
      }).then(() => undefined),
    );

    assert.match(String(error), /requires its exact active Student Enrollment Grade Correction mapping/);
    assert.deepEqual(await transaction.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: source.id },
      select: { status: true, replacedAt: true, selectionAcademicTermId: true },
    }), { status: "ACTIVE", replacedAt: null, selectionAcademicTermId });
    assert.equal(await transaction.studentEnrollmentGradeCorrection.count({
      where: { enrollmentId: fixture.enrollment.id },
    }), 0);
  });
});

test("zero-SSE Grade 7 correction creates eight Grade 8 rows without child links", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction);
    const result = await correctFixture(fixture, transaction);
    const [rows, correction, childCount, auditCount] = await Promise.all([
      transaction.studentSubjectEnrollment.findMany({
        where: { enrollmentId: fixture.enrollment.id },
        include: { terms: true },
      }),
      transaction.studentEnrollmentGradeCorrection.findUniqueOrThrow({ where: { id: result.correctionId } }),
      transaction.studentParticipationCorrection.count({
        where: { studentEnrollmentGradeCorrectionId: result.correctionId },
      }),
      transaction.auditLog.count({
        where: {
          OR: [
            { module: "StudentEnrollmentGradeCorrection", recordId: result.correctionId },
            { module: "Enrollment", recordId: fixture.enrollment.id },
            { module: "StudentSubjectEnrollment", metadata: { path: ["correctionId"], equals: result.correctionId } },
          ],
        },
      }),
    ]);
    assert.equal(rows.length, 8);
    assert.equal(rows.flatMap(({ terms }) => terms).length, 24);
    assert.ok(rows.every(({ gradeLevel, status }) => gradeLevel === "8" && status === "ACTIVE"));
    assert.equal(correction.sourceParticipationCount, 0);
    assert.equal(correction.replacementParticipationCount, 8);
    assert.equal(childCount, 0);
    assert.equal(auditCount, 10);
  });
});

test("after the first Term starts the exact typed phrase is required", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction);
    const firstStart = fixture.academicYear.terms[0]!.startDate;
    assert.ok(firstStart.getTime() <= Date.now(), "the active Academic Year baseline must already have started");

    for (const typedConfirmation of [undefined, "CHANGE GRADE 7 TO GRADE 9"]) {
      await assert.rejects(
        correctFixture(fixture, transaction, { typedConfirmation }),
        /Type CHANGE GRADE 7 TO GRADE 8 exactly/,
      );
      assert.equal(await transaction.studentEnrollmentGradeCorrection.count({
        where: { enrollmentId: fixture.enrollment.id },
      }), 0);
    }
    await correctFixture(fixture, transaction);
  });
});

test("DRAFT and FINALIZED result evidence each block correction atomically", async () => {
  for (const status of ["DRAFT", "FINALIZED"] as const) {
    await withRollback(async (transaction) => {
      const fixture = await createFixture(transaction, { deriveSource: true });
      const source = await transaction.studentSubjectEnrollment.findFirstOrThrow({
        where: { enrollmentId: fixture.enrollment.id },
        include: { terms: true },
      });
      await seedDefensiveEvidence(transaction, () => transaction.shsTermResult.create({
        data: {
          studentSubjectEnrollmentId: source.id,
          academicTermId: source.terms[0]!.academicTermId,
          finalResult: 88,
          status,
          createdById: fixture.actor.id,
          finalizedById: status === "FINALIZED" ? fixture.actor.id : undefined,
          finalizedAt: status === "FINALIZED" ? new Date() : undefined,
        },
      }).then(() => undefined), new Set(["ShsTermResult"]));

      await assert.rejects(correctFixture(fixture, transaction), /Attached results block grade-level correction/);
      assert.equal((await transaction.enrollment.findUniqueOrThrow({ where: { id: fixture.enrollment.id } })).sectionId, fixture.source.id);
      assert.equal(await transaction.studentEnrollmentGradeCorrection.count({ where: { enrollmentId: fixture.enrollment.id } }), 0);
      assert.equal(await transaction.studentSubjectEnrollment.count({
        where: { enrollmentId: fixture.enrollment.id, status: "ACTIVE", gradeLevel: "7" },
      }), 8);
      assert.equal(await transaction.studentSubjectEnrollment.count({
        where: { enrollmentId: fixture.enrollment.id, gradeLevel: "8" },
      }), 0);
    });
  }
});

test("REPLACED and DROPPED source history each block correction", async () => {
  for (const status of ["REPLACED", "DROPPED"] as const) {
    await withRollback(async (transaction) => {
      const fixture = await createFixture(transaction, { deriveSource: true });
      const source = await transaction.studentSubjectEnrollment.findFirstOrThrow({
        where: { enrollmentId: fixture.enrollment.id },
      });
      await seedDefensiveEvidence(transaction, () => transaction.studentSubjectEnrollment.update({
        where: { id: source.id },
        data: status === "REPLACED"
          ? { status, replacedAt: new Date() }
          : { status, droppedAt: new Date(), dropReason: "Defensive terminal-history fixture" },
      }).then(() => undefined), new Set(["StudentSubjectEnrollment"]), status === "REPLACED"
        ? [["StudentSubjectEnrollment", "StudentSubjectEnrollment_assert_lifecycle_transition_trigger"]]
        : []);

      const error = await rollbackToSavepoint(
        transaction,
        () => correctFixture(fixture, transaction).then(() => undefined),
      );
      assert.match(String(error), /REPLACED or DROPPED history/);
      assert.equal((await transaction.enrollment.findUniqueOrThrow({ where: { id: fixture.enrollment.id } })).sectionId, fixture.source.id);
      assert.equal(await transaction.studentEnrollmentGradeCorrection.count({ where: { enrollmentId: fixture.enrollment.id } }), 0);
    });
  }
});

test("an incomplete destination Curriculum blocks before any correction writes", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction, { deriveSource: true });
    const offering = await transaction.subjectOffering.findFirstOrThrow({
      where: { academicYearId: fixture.academicYear.id, subjectCode: "FIL8", deletedAt: null },
      select: { id: true },
    });
    await transaction.$executeRawUnsafe(
      'ALTER TABLE "SubjectOffering" DISABLE TRIGGER "SubjectOffering_enforce_curriculum_lock_trigger"',
    );
    try {
      await transaction.subjectOffering.update({ where: { id: offering.id }, data: { deletedAt: new Date() } });
    } finally {
      await transaction.$executeRawUnsafe(
        'ALTER TABLE "SubjectOffering" ENABLE TRIGGER "SubjectOffering_enforce_curriculum_lock_trigger"',
      );
    }

    const before = await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      select: { id: true, status: true, replacedAt: true },
      orderBy: { id: "asc" },
    });
    await assert.rejects(correctFixture(fixture, transaction), /destination Curriculum must contain exactly the eight/);
    assert.equal((await transaction.enrollment.findUniqueOrThrow({ where: { id: fixture.enrollment.id } })).sectionId, fixture.source.id);
    assert.deepEqual(await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      select: { id: true, status: true, replacedAt: true },
      orderBy: { id: "asc" },
    }), before);
    assert.equal(await transaction.studentEnrollmentGradeCorrection.count({ where: { enrollmentId: fixture.enrollment.id } }), 0);
  });
});

test("source participation with mismatched Offering provenance is rejected atomically", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction, { deriveSource: true });
    const [source, wrongOffering] = await Promise.all([
      transaction.studentSubjectEnrollment.findFirstOrThrow({
        where: { enrollmentId: fixture.enrollment.id, subjectCode: "FIL7" },
        select: { id: true },
      }),
      transaction.subjectOffering.findFirstOrThrow({
        where: { academicYearId: fixture.academicYear.id, subjectCode: "FIL8", deletedAt: null },
        select: { id: true },
      }),
    ]);
    await seedDefensiveEvidence(
      transaction,
      () => transaction.studentSubjectEnrollment.update({
        where: { id: source.id },
        data: { subjectOfferingId: wrongOffering.id },
      }).then(() => undefined),
      new Set(["StudentSubjectEnrollment"]),
      [["StudentSubjectEnrollment", "StudentSubjectEnrollment_assert_source_year_trigger"]],
    );

    const error = await rollbackToSavepoint(
      transaction,
      () => correctFixture(fixture, transaction).then(() => undefined),
    );
    assert.match(
      String(error),
      /does not match its immutable regular JHS Offering|must match exact historical baseline Offering evidence/,
    );
    assert.equal((await transaction.enrollment.findUniqueOrThrow({
      where: { id: fixture.enrollment.id },
    })).sectionId, fixture.source.id);
    assert.equal(await transaction.studentEnrollmentGradeCorrection.count({
      where: { enrollmentId: fixture.enrollment.id },
    }), 0);
  });
});

test("direct JHS-to-SHS destination fails with a safe grade-correction domain error", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction, { destinationGrade: "11" });
    await assert.rejects(
      correctFixture(fixture, transaction),
      /destination must be an active regular JHS Grade 7-10 Section/,
    );
    assert.equal(await transaction.studentEnrollmentGradeCorrection.count({
      where: { enrollmentId: fixture.enrollment.id },
    }), 0);
  });
});

test("zero-source correction rejects prior and in-progress destination Subject mutation", async () => {
  await withRollback(async (transaction) => {
    const priorFixture = await createFixture(transaction);
    const priorSubject = await transaction.subject.findFirstOrThrow({
      where: {
        offerings: {
          some: {
            academicYearId: priorFixture.academicYear.id,
            gradeLevel: priorFixture.destination.gradeLevel,
            subjectCode: "FIL8",
            deletedAt: null,
          },
        },
      },
      select: { id: true },
    });
    await transaction.subject.update({
      where: { id: priorSubject.id },
      data: { updatedAt: new Date() },
    });
    const error = await rollbackToSavepoint(
      transaction,
      () => correctFixture(priorFixture, transaction).then(() => undefined),
    );
    assert.match(String(error), /cannot follow destination Subject Offering configuration mutation/);
    assert.equal(await transaction.studentEnrollmentGradeCorrection.count({
      where: { enrollmentId: priorFixture.enrollment.id },
    }), 0);
  });

  await withRollback(async (transaction) => {
    const activeFixture = await createFixture(transaction);
    const activeSubject = await transaction.subject.findFirstOrThrow({
      where: {
        offerings: {
          some: {
            academicYearId: activeFixture.academicYear.id,
            gradeLevel: activeFixture.destination.gradeLevel,
            subjectCode: "FIL8",
            deletedAt: null,
          },
        },
      },
      select: { id: true },
    });
    await correctFixture(activeFixture, transaction);
    const error = await rollbackToSavepoint(transaction, () =>
      transaction.subject.update({
        where: { id: activeSubject.id },
        data: { updatedAt: new Date() },
      }).then(() => undefined),
    );
    assert.match(String(error), /Destination Subject in a Student Enrollment Grade Correction cannot be mutated/);
  });
});

test("SHS and same-grade placements are rejected by the grade command", async () => {
  const scenarios = [
    { options: { sourceGrade: "11", destinationGrade: "8" }, message: /source must be an active regular JHS/ },
    { options: { sourceGrade: "7", destinationGrade: "7" }, message: /different destination grade and Section/ },
  ] as const;
  for (const scenario of scenarios) {
    await withRollback(async (transaction) => {
      const fixture = await createFixture(transaction, scenario.options);
      await assert.rejects(correctFixture(fixture, transaction), scenario.message);
      assert.equal(await transaction.studentEnrollmentGradeCorrection.count({ where: { enrollmentId: fixture.enrollment.id } }), 0);
    });
  }
});

test("forged GUCs and replayed parent events cannot authorize placement changes", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction);
    await transaction.$queryRaw`SELECT set_config('nemesys.student_enrollment_grade_correction_id', ${randomUUID()}, true)`;
    const forgedError = await rollbackToSavepoint(transaction, () => transaction.enrollment.update({
      where: { id: fixture.enrollment.id },
      data: { sectionId: fixture.destination.id },
    }).then(() => undefined));
    assert.match(String(forgedError), /context does not match|exact Student Enrollment Correction context/);

    const correctionId = randomUUID();
    await correctFixture(fixture, transaction, {}, correctionId);
    const parentUpdateError = await rollbackToSavepoint(transaction, () =>
      transaction.studentEnrollmentGradeCorrection.update({
        where: { id: correctionId },
        data: { reason: "Replayed" },
      }).then(() => undefined),
    );
    assert.match(String(parentUpdateError), /immutable/);
    const parentDeleteError = await rollbackToSavepoint(transaction, () =>
      transaction.studentEnrollmentGradeCorrection.delete({ where: { id: correctionId } }).then(() => undefined),
    );
    assert.match(String(parentDeleteError), /immutable/);

    await transaction.$queryRaw`SELECT set_config('nemesys.student_enrollment_grade_correction_id', ${correctionId}, true)`;
    const replayError = await rollbackToSavepoint(transaction, () => transaction.enrollment.update({
      where: { id: fixture.enrollment.id },
      data: { sectionId: fixture.source.id },
    }).then(() => undefined));
    assert.match(String(replayError), /context does not match|newest in-transaction/);
  });
});

test("correction children, unlisted transitions, old Terms, DROPPED, results, and Grades remain immutable", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction, { deriveSource: true });
    const { correctionId } = await correctFixture(fixture, transaction);
    const child = await transaction.studentParticipationCorrection.findFirstOrThrow({
      where: { studentEnrollmentGradeCorrectionId: correctionId },
    });
    const source = await transaction.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: child.sourceStudentSubjectEnrollmentId },
      include: { terms: true },
    });
    const replacement = await transaction.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: child.replacementStudentSubjectEnrollmentId },
    });

    const childUpdateError = await rollbackToSavepoint(transaction, () =>
      transaction.studentParticipationCorrection.update({
        where: { id: child.id },
        data: { canonicalSubjectPrefix: "ENG" },
      }).then(() => undefined),
    );
    assert.match(String(childUpdateError), /immutable/);
    const childDeleteError = await rollbackToSavepoint(transaction, () =>
      transaction.studentParticipationCorrection.delete({ where: { id: child.id } }).then(() => undefined),
    );
    assert.match(String(childDeleteError), /immutable/);

    const unlistedError = await rollbackToSavepoint(transaction, () =>
      transaction.studentSubjectEnrollment.update({
        where: { id: replacement.id },
        data: { status: "REPLACED", replacedAt: new Date() },
      }).then(() => undefined),
    );
    assert.match(String(unlistedError), /exact listed ACTIVE to REPLACED|cannot mutate old Terms/);

    const otherTerm = fixture.academicYear.terms.find(({ id }) => id !== source.terms[0]!.academicTermId)!;
    const termUpdateError = await rollbackToSavepoint(transaction, () =>
      transaction.studentSubjectEnrollmentTerm.update({
        where: {
          studentSubjectEnrollmentId_academicTermId: {
            studentSubjectEnrollmentId: source.id,
            academicTermId: source.terms[0]!.academicTermId,
          },
        },
        data: { academicTermId: otherTerm.id },
      }).then(() => undefined),
    );
    assert.match(String(termUpdateError), /cannot mutate old Terms/);
    const termDeleteError = await rollbackToSavepoint(transaction, () =>
      transaction.studentSubjectEnrollmentTerm.delete({
        where: {
          studentSubjectEnrollmentId_academicTermId: {
            studentSubjectEnrollmentId: source.id,
            academicTermId: source.terms[0]!.academicTermId,
          },
        },
      }).then(() => undefined),
    );
    assert.match(String(termDeleteError), /cannot mutate old Terms|history cannot be hard-deleted/);

    const droppedError = await rollbackToSavepoint(transaction, () =>
      transaction.studentSubjectEnrollment.update({
        where: { id: replacement.id },
        data: { status: "DROPPED", droppedAt: new Date(), dropReason: "Forged drop" },
      }).then(() => undefined),
    );
    assert.match(String(droppedError), /DROPPED lifecycle|cannot mutate old Terms/);
    const resultError = await rollbackToSavepoint(transaction, () => transaction.shsTermResult.create({
      data: {
        studentSubjectEnrollmentId: source.id,
        academicTermId: source.terms[0]!.academicTermId,
        finalResult: 90,
        createdById: fixture.actor.id,
      },
    }).then(() => undefined));
    assert.match(String(resultError), /cannot mutate old Terms, results, Grades/);

    const subject = await transaction.subjectOffering.findUniqueOrThrow({
      where: { id: source.subjectOfferingId },
      select: { subjectId: true },
    });
    const gradeError = await rollbackToSavepoint(transaction, () => transaction.grade.create({
      data: {
        enrollmentId: fixture.enrollment.id,
        subjectId: subject.subjectId,
        firstQuarter: 90,
        createdById: fixture.actor.id,
      },
    }).then(() => undefined));
    assert.match(String(gradeError), /cannot mutate old Terms, results, Grades/);
  });
});

test("forced correction audit failure rolls back parent, participation, Enrollment, and Student writes", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createFixture(transaction, { deriveSource: true });
    const before = await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      select: { id: true, status: true, replacedAt: true },
      orderBy: { id: "asc" },
    });
    await transaction.$executeRawUnsafe(`
      CREATE FUNCTION "Phase21FB_reject_correction_audit"() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW."module" = 'StudentEnrollmentGradeCorrection' THEN
          RAISE EXCEPTION 'forced Phase 21F-B audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await transaction.$executeRawUnsafe(`
      CREATE TRIGGER "Phase21FB_reject_correction_audit_trigger"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "Phase21FB_reject_correction_audit"()
    `);
    const correctionId = randomUUID();
    const error = await rollbackToSavepoint(transaction, () =>
      correctFixture(fixture, transaction, {}, correctionId).then(() => undefined),
    );
    assert.match(String(error), /forced Phase 21F-B audit failure/);
    assert.equal(await transaction.studentEnrollmentGradeCorrection.count({ where: { id: correctionId } }), 0);
    assert.equal(await transaction.studentParticipationCorrection.count({
      where: { studentEnrollmentGradeCorrectionId: correctionId },
    }), 0);
    assert.equal((await transaction.enrollment.findUniqueOrThrow({ where: { id: fixture.enrollment.id } })).sectionId, fixture.source.id);
    assert.equal((await transaction.student.findUniqueOrThrow({ where: { id: fixture.student.id } })).currentSectionId, fixture.source.id);
    assert.deepEqual(await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id },
      select: { id: true, status: true, replacedAt: true },
      orderBy: { id: "asc" },
    }), before);
  });
});
