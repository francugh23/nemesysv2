import { randomInt, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { correctSubjectOfferingInTransaction } from "../../services/curriculum-correction.service";
import { progressShsCurrentTermInTransaction } from "../../services/student-subject-enrollment-selection.service";
import { mapCurrentOfferingIdsToActiveIdentities } from "../../lib/subject-offering-lineage";
import type { CorrectSubjectOfferingInput } from "../../schemas";
import { createLegacyPolicyFixture, makeLegacyActiveCurriculumConfigurable } from "../helpers/phase-21e-e1-legacy-fixture";

class RollbackFixture extends Error {}
const NOW_CLOCK = () => new Date();

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
async function expectDatabaseRejection(
  transaction: Prisma.TransactionClient,
  operation: () => Promise<unknown>,
  pattern: RegExp,
) {
  savepointSequence += 1;
  const savepoint = `e2a_rejection_${savepointSequence}`;
  await transaction.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    await operation();
    assert.fail("Expected database rejection.");
  } catch (error) {
    assert.match(String(error), pattern);
  } finally {
    await transaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await transaction.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

async function fixture(
  transaction: Prisma.TransactionClient,
  depended: boolean,
  classification: "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE" = "CORE",
) {
  const source = await transaction.subjectOffering.findFirst({
    where: {
      deletedAt: null,
      academicYear: { status: "ACTIVE", curriculumFinalization: { isNot: null } },
      gradeLevel: "11",
      shsContext: { curriculumStatus: "SCHOOL_APPROVED", classification },
      sourceCurriculumCorrection: null,
      studentSubjectEnrollments: depended ? { some: { enrollment: { status: "ACTIVE", deletedAt: null } } } : { none: {} },
      terms: { some: { academicTerm: { position: 3 } } },
    },
    select: {
      id: true,
      subjectId: true,
      subjectCode: true,
      subjectDescription: true,
      gradeLevel: true,
      academicYearId: true,
      createdById: true,
      shsContext: { include: { cluster: true } },
      academicYear: { select: { terms: { select: { id: true, position: true }, orderBy: { position: "asc" } } } },
    },
  });
  assert.ok(source, `Expected a ${depended ? "depended" : "unused"} approved ${classification} Offering fixture.`);
  const effectiveTerm = source.academicYear.terms.find(({ position }) => position === 2);
  assert.ok(effectiveTerm);
  return { source, effectiveTerm };
}

async function createActiveParticipation(
  source: Awaited<ReturnType<typeof fixture>>["source"],
  transaction: Prisma.TransactionClient,
  academicTermIds = source.academicYear.terms.map(({ id }) => id),
) {
  const section = await transaction.section.create({
    data: { gradeLevel: "11", sectionName: `E2A-${randomUUID()}`, createdById: source.createdById },
  });
  const student = await transaction.student.create({
    data: {
      lrn: String(randomInt(100_000_000_000, 999_999_999_999)),
      firstName: "E2A",
      lastName: "History",
      gender: "MALE",
      barangay: "Test",
      municipality: "Test",
      province: "Test",
      status: "ENROLLED",
      currentSectionId: section.id,
      createdById: source.createdById,
    },
  });
  const entryTerm = source.academicYear.terms.find(({ position }) => position === 1);
  assert.ok(entryTerm);
  const enrollment = await transaction.enrollment.create({
    data: {
      studentId: student.id,
      sectionId: section.id,
      academicYearId: source.academicYearId,
      entryAcademicTermId: entryTerm.id,
      shsTrack: "ACADEMIC",
      status: "ACTIVE",
      createdById: source.createdById,
    },
  });
  assert.ok(source.shsContext);
  await transaction.studentSubjectEnrollment.create({
    data: {
      enrollmentId: enrollment.id,
      subjectOfferingId: source.id,
      subjectCode: source.subjectCode,
      subjectDescription: source.subjectDescription,
      gradeLevel: source.gradeLevel,
      shsClassification: source.shsContext.classification,
      shsClusterCode: source.shsContext.cluster?.code ?? null,
      shsClusterName: source.shsContext.cluster?.name ?? null,
      shsCurriculumStatus: source.shsContext.curriculumStatus,
      shsSourceReference: source.shsContext.sourceReference,
      shsApprovalReference: source.shsContext.approvalReference,
      createdById: source.createdById,
      terms: { create: academicTermIds.map((academicTermId) => ({ academicTermId })) },
    },
  });
  return enrollment.id;
}

async function configureCurrentInterTermGap(academicYearId: string, transaction: Prisma.TransactionClient) {
  const terms = await transaction.academicTerm.findMany({ where: { academicYearId }, orderBy: { position: "asc" } });
  assert.equal(terms.length, 3);
  const today = new Date();
  const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
  const tomorrow = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));
  await transaction.$executeRawUnsafe('ALTER TABLE "AcademicTerm" DISABLE TRIGGER "AcademicTerm_enforce_draft_year_trigger"');
  try {
    await transaction.academicTerm.update({ where: { id: terms[0]!.id }, data: { endDate: yesterday } });
    await transaction.academicTerm.update({ where: { id: terms[1]!.id }, data: { startDate: tomorrow } });
  } finally {
    await transaction.$executeRawUnsafe('ALTER TABLE "AcademicTerm" ENABLE TRIGGER "AcademicTerm_enforce_draft_year_trigger"');
  }
}

async function activateEffectiveTerm(academicTermId: string, transaction: Prisma.TransactionClient) {
  const today = new Date();
  const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  await transaction.$executeRawUnsafe('ALTER TABLE "AcademicTerm" DISABLE TRIGGER "AcademicTerm_enforce_draft_year_trigger"');
  try {
    await transaction.academicTerm.update({ where: { id: academicTermId }, data: { startDate } });
  } finally {
    await transaction.$executeRawUnsafe('ALTER TABLE "AcademicTerm" ENABLE TRIGGER "AcademicTerm_enforce_draft_year_trigger"');
  }
}

function values(source: Awaited<ReturnType<typeof fixture>>["source"], effectiveTermId: string): CorrectSubjectOfferingInput {
  assert.ok(source.shsContext?.sourceReference);
  const classification = source.shsContext.classification;
  const shsContext = classification === "CORE"
    ? {
        classification,
        sourceReference: "New E2-A replacement provenance",
        approvalReference: "E2-A replacement approval",
      }
    : {
        classification,
        clusterId: source.shsContext.cluster?.id ?? "",
        sourceReference: "New E2-A replacement provenance",
        approvalReference: "E2-A replacement approval",
      };
  return {
    sourceOfferingId: source.id,
    effectiveAcademicTermId: effectiveTermId,
    reason: "Documented E2-A configuration correction.",
    evidenceReference: "E2-A test memorandum",
    confirmation: source.subjectCode,
    replacement: {
      subjectId: source.subjectId,
      gradeLevel: "11" as const,
      academicTermIds: source.academicYear.terms
        .filter((term) => term.position >= source.academicYear.terms.find((candidate) => candidate.id === effectiveTermId)!.position)
        .map(({ id }) => id),
      shsContext,
    },
  };
}

test("finalized Curriculum correction atomically archives predecessor and creates approved successor, lineage, correction, and audits", async () => {
  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await fixture(transaction, false);
    await configureCurrentInterTermGap(source.academicYearId, transaction);
    const beforeFinalization = await transaction.curriculumFinalization.findUnique({ where: { academicYearId: source.academicYearId } });
    const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    const selfCorrectionId = randomUUID();
    await transaction.$queryRaw`SELECT set_config('nemesys.curriculum_correction_id', ${selfCorrectionId}, true)`;
    await expectDatabaseRejection(transaction, () => transaction.curriculumCorrection.create({
      data: {
        id: selfCorrectionId,
        academicYearId: source.academicYearId,
        sourceOfferingId: source.id,
        replacementOfferingId: source.id,
        effectiveAcademicTermId: effectiveTerm.id,
        reason: "Invalid self replacement",
        evidenceReference: "E2-A integrity test",
        sourceWasFinalized: true,
        sourceParticipationCount: 0,
        sourceConfigurationSnapshot: {},
        replacementConfigurationSnapshot: {},
        correctedById: source.createdById,
        correctedAt: NOW_CLOCK(),
      },
    }), /replacement identity must be new|distinct_offerings|source snapshot/i);
    const result = await correctSubjectOfferingInTransaction(values(source, effectiveTerm.id), source.createdById, transaction, NOW_CLOCK, ids);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");

    assert.deepEqual(result, { correctionId: ids.correctionId, sourceOfferingId: source.id, replacementOfferingId: ids.replacementOfferingId });
    const predecessor = await transaction.subjectOffering.findUnique({ where: { id: source.id } });
    const replacement = await transaction.subjectOffering.findUnique({ where: { id: ids.replacementOfferingId }, include: { terms: true, shsContext: true } });
    const correction = await transaction.curriculumCorrection.findUnique({ where: { id: ids.correctionId } });
    const audits = await transaction.auditLog.count({ where: { metadata: { path: ["correctionId"], equals: ids.correctionId } } });
    const afterFinalization = await transaction.curriculumFinalization.findUnique({ where: { academicYearId: source.academicYearId } });
    assert.ok(predecessor?.deletedAt);
    assert.equal(replacement?.replacesSubjectOfferingId, source.id);
    assert.deepEqual(
      replacement?.terms.map(({ academicTermId }) => academicTermId).sort(),
      source.academicYear.terms.filter(({ position }) => position >= effectiveTerm.position).map(({ id }) => id).sort(),
    );
    assert.equal(replacement?.shsContext?.curriculumStatus, "SCHOOL_APPROVED");
    assert.equal(correction?.sourceWasFinalized, true);
    assert.equal(correction?.sourceParticipationCount, 0);
    assert.equal(audits, 3);
    assert.deepEqual(afterFinalization, beforeFinalization);
    await expectDatabaseRejection(transaction, () => transaction.subjectOffering.update({
      where: { id: ids.replacementOfferingId },
      data: { replacesSubjectOfferingId: ids.replacementOfferingId },
    }), /replacement lineage is immutable|Correction-linked Curriculum Offerings are immutable/i);
    await expectDatabaseRejection(transaction, () => transaction.subjectOffering.create({
      data: {
        id: randomUUID(),
        subjectId: source.subjectId,
        academicYearId: source.academicYearId,
        gradeLevel: "11",
        subjectCode: source.subjectCode,
        subjectDescription: "Invalid duplicate successor",
        createdById: source.createdById,
        replacesSubjectOfferingId: source.id,
      },
    }), /dedicated correction transaction/i);
    await expectDatabaseRejection(transaction, () => transaction.curriculumCorrection.update({
      where: { id: ids.correctionId },
      data: { reason: "Rewritten reason" },
    }), /correction records are immutable/i);
  });
});

test("partial-Term predecessor Core covers only its immutable Term and successor materializes the uncovered Term", async () => {
  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await fixture(transaction, false);
    const firstTerm = source.academicYear.terms.find(({ position }) => position === 1);
    assert.ok(firstTerm);
    const enrollmentId = await createActiveParticipation(source, transaction, [firstTerm.id]);
    await makeLegacyActiveCurriculumConfigurable(source.academicYearId, transaction);
    await configureCurrentInterTermGap(source.academicYearId, transaction);
    const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    await correctSubjectOfferingInTransaction(
      values(source, effectiveTerm.id), source.createdById, transaction, NOW_CLOCK, ids,
    );
    await createLegacyPolicyFixture({
      academicYearId: source.academicYearId,
      academicTermId: effectiveTerm.id,
      gradeLevel: "11",
      minimumElectives: 1,
      maximumElectives: 3,
      createdById: source.createdById,
    }, transaction);
    const elective = await transaction.subjectOffering.findFirstOrThrow({
      where: {
        academicYearId: source.academicYearId,
        gradeLevel: "11",
        deletedAt: null,
        terms: { some: { academicTermId: effectiveTerm.id } },
        shsContext: { classification: { in: ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"] }, curriculumStatus: "SCHOOL_APPROVED", cluster: { deletedAt: null } },
      },
      select: { id: true },
    });
    await activateEffectiveTerm(effectiveTerm.id, transaction);
    const result = await progressShsCurrentTermInTransaction(
      { enrollmentId, subjectOfferingIds: [elective.id] },
      source.createdById,
      transaction,
      NOW_CLOCK,
    );
    const predecessor = await transaction.studentSubjectEnrollment.findFirstOrThrow({
      where: { enrollmentId, subjectOfferingId: source.id },
      select: { status: true, terms: { select: { academicTermId: true } } },
    });
    const successor = await transaction.studentSubjectEnrollment.findFirstOrThrow({
      where: { enrollmentId, subjectOfferingId: ids.replacementOfferingId },
      select: { status: true, terms: { select: { academicTermId: true } } },
    });
    assert.equal(result.replacedCore, 0);
    assert.deepEqual(predecessor, { status: "ACTIVE", terms: [{ academicTermId: firstTerm.id }] });
    assert.deepEqual(successor, {
      status: "ACTIVE",
      terms: source.academicYear.terms
        .filter(({ position }) => position >= effectiveTerm.position)
        .map(({ id }) => ({ academicTermId: id })),
    });
  });
});

test("corrected elective maps to its active successor and remains retained when another elective is added", async () => {
  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await fixture(transaction, false, "TECHPRO_ELECTIVE");
    const enrollmentId = await createActiveParticipation(source, transaction, [effectiveTerm.id]);
    await makeLegacyActiveCurriculumConfigurable(source.academicYearId, transaction);
    await configureCurrentInterTermGap(source.academicYearId, transaction);
    await createLegacyPolicyFixture({
      academicYearId: source.academicYearId,
      academicTermId: effectiveTerm.id,
      gradeLevel: "11",
      minimumElectives: 1,
      maximumElectives: 3,
      createdById: source.createdById,
    }, transaction);
    const laterTerms = source.academicYear.terms.filter(({ position }) => position > effectiveTerm.position);
    for (const term of laterTerms) {
      await createLegacyPolicyFixture({
        academicYearId: source.academicYearId,
        academicTermId: term.id,
        gradeLevel: "11",
        minimumElectives: 1,
        maximumElectives: 3,
        createdById: source.createdById,
      }, transaction);
    }
    const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    await correctSubjectOfferingInTransaction(
      values(source, effectiveTerm.id), source.createdById, transaction, NOW_CLOCK, ids,
    );
    const additional = await transaction.subjectOffering.findFirstOrThrow({
      where: {
        id: { notIn: [source.id, ids.replacementOfferingId] },
        academicYearId: source.academicYearId,
        gradeLevel: "11",
        deletedAt: null,
        terms: { some: { academicTermId: effectiveTerm.id } },
        shsContext: { classification: { in: ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"] }, curriculumStatus: "SCHOOL_APPROVED", cluster: { deletedAt: null } },
      },
      select: { id: true },
    });
    const lineage = [{ offeringId: ids.replacementOfferingId, ancestorOfferingId: source.id }];
    assert.deepEqual(
      mapCurrentOfferingIdsToActiveIdentities([source.id], [ids.replacementOfferingId, additional.id], lineage),
      [ids.replacementOfferingId],
    );
    await activateEffectiveTerm(effectiveTerm.id, transaction);
    const result = await progressShsCurrentTermInTransaction(
      { enrollmentId, subjectOfferingIds: [ids.replacementOfferingId, additional.id] },
      source.createdById,
      transaction,
      NOW_CLOCK,
    );
    assert.equal(result.retainedElectives, 1);
    assert.equal(result.createdElectives, 1);
    assert.equal(result.currentElectiveCount, 2);
    assert.equal(await transaction.studentSubjectEnrollment.count({
      where: { enrollmentId, subjectOfferingId: source.id, status: "ACTIVE" },
    }), 1);
    assert.equal(await transaction.studentSubjectEnrollment.count({
      where: { enrollmentId, subjectOfferingId: ids.replacementOfferingId },
    }), 0);
  });
});

test("dependency-locked unfinalized correction preserves all SSE, Term membership, result, and Enrollment history", async () => {
  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await fixture(transaction, false);
    const activeEnrollmentId = await createActiveParticipation(source, transaction);
    const participation = await transaction.studentSubjectEnrollment.findFirstOrThrow({
      where: { enrollmentId: activeEnrollmentId, subjectOfferingId: source.id },
      select: { id: true },
    });
    await transaction.shsTermResult.create({
      data: {
        studentSubjectEnrollmentId: participation.id,
        academicTermId: source.academicYear.terms[0]!.id,
        finalResult: new Prisma.Decimal("88.50"),
        createdById: source.createdById,
      },
    });
    await makeLegacyActiveCurriculumConfigurable(source.academicYearId, transaction);
    await configureCurrentInterTermGap(source.academicYearId, transaction);
    const before = await transaction.studentSubjectEnrollment.findMany({
      where: { subjectOfferingId: source.id },
      include: { terms: { include: { result: true } }, enrollment: true },
      orderBy: { id: "asc" },
    });
    const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    await correctSubjectOfferingInTransaction(values(source, effectiveTerm.id), source.createdById, transaction, NOW_CLOCK, ids);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    const after = await transaction.studentSubjectEnrollment.findMany({
      where: { subjectOfferingId: source.id },
      include: { terms: { include: { result: true } }, enrollment: true },
      orderBy: { id: "asc" },
    });
    assert.deepEqual(after, before);
    assert.equal(await transaction.studentSubjectEnrollment.count({ where: { subjectOfferingId: ids.replacementOfferingId } }), 0);
    const correction = await transaction.curriculumCorrection.findUnique({ where: { id: ids.correctionId } });
    assert.equal(correction?.sourceWasFinalized, false);
    assert.equal(correction?.sourceParticipationCount, before.length);

    const enrollmentId = before.find(({ enrollment }) => enrollment.status === "ACTIVE" && !enrollment.deletedAt)?.enrollmentId;
    assert.ok(enrollmentId);
    assert.equal(enrollmentId, activeEnrollmentId);
    const elective = await transaction.subjectOffering.findFirst({
      where: {
        academicYearId: source.academicYearId,
        gradeLevel: "11",
        deletedAt: null,
        shsContext: { curriculumStatus: "SCHOOL_APPROVED", classification: { in: ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"] } },
        terms: { some: { academicTermId: effectiveTerm.id } },
      },
      select: { id: true },
    });
    assert.ok(elective);
    await activateEffectiveTerm(effectiveTerm.id, transaction);
    await createLegacyPolicyFixture({
      academicYearId: source.academicYearId,
      academicTermId: effectiveTerm.id,
      gradeLevel: "11",
      minimumElectives: 1,
      maximumElectives: 3,
      createdById: source.createdById,
    }, transaction);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
    await progressShsCurrentTermInTransaction({ enrollmentId, subjectOfferingIds: [elective.id] }, source.createdById, transaction, NOW_CLOCK);
    assert.equal(await transaction.studentSubjectEnrollment.count({ where: { enrollmentId, subjectOfferingId: ids.replacementOfferingId } }), 0);
    assert.equal(await transaction.studentSubjectEnrollment.count({ where: { enrollmentId, subjectOfferingId: source.id, status: "ACTIVE" } }), 1);
  });
});

test("E2-A rejects active-Term, post-year, foreign-Term, and unlocked ordinary-workflow attempts", async () => {
  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await fixture(transaction, false);
    await assert.rejects(
      correctSubjectOfferingInTransaction(values(source, effectiveTerm.id), source.createdById, transaction, () => new Date("2026-08-20T00:00:00+08:00")),
      /unavailable during active/i,
    );
    await assert.rejects(
      correctSubjectOfferingInTransaction(values(source, effectiveTerm.id), source.createdById, transaction, () => new Date("2027-05-01T00:00:00+08:00")),
      /after all configured/i,
    );
    await assert.rejects(
      correctSubjectOfferingInTransaction({ ...values(source, effectiveTerm.id), effectiveAcademicTermId: randomUUID() }, source.createdById, transaction, () => new Date("2026-12-20T00:00:00+08:00")),
      /immediately next unstarted/i,
    );
    await makeLegacyActiveCurriculumConfigurable(source.academicYearId, transaction);
    await assert.rejects(
      correctSubjectOfferingInTransaction(values(source, effectiveTerm.id), source.createdById, transaction, () => new Date("2026-12-20T00:00:00+08:00")),
      /ordinary edit or archive workflow/i,
    );
  });
});

test("database context alone cannot bypass E1 or mutate an unrelated finalized Offering", async () => {
  await withRollback(async (transaction) => {
    const { source } = await fixture(transaction, false);
    await transaction.$queryRaw`SELECT set_config('nemesys.curriculum_correction_id', ${randomUUID()}, true)`;
    await assert.rejects(
      transaction.subjectOffering.update({ where: { id: source.id }, data: { deletedAt: new Date() } }),
      /Finalized Curriculum cannot be changed/i,
    );
  });
});

test("audit rejection rolls back predecessor archive, successor, and correction", async () => {
  const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
  let sourceId = "";
  await assert.rejects(prisma.$transaction(async (transaction) => {
    const { source, effectiveTerm } = await fixture(transaction, false);
    await configureCurrentInterTermGap(source.academicYearId, transaction);
    sourceId = source.id;
    await transaction.$executeRawUnsafe(`
      CREATE FUNCTION "E2A_reject_audit"() RETURNS TRIGGER AS $$
      BEGIN
        IF NEW."module" = 'CurriculumCorrection' THEN RAISE EXCEPTION 'Forced E2-A audit failure'; END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
    `);
    await transaction.$executeRawUnsafe(`
      CREATE TRIGGER "E2A_reject_audit_trigger" BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "E2A_reject_audit"();
    `);
    await correctSubjectOfferingInTransaction(values(source, effectiveTerm.id), source.createdById, transaction, NOW_CLOCK, ids);
  }), /Controlled Curriculum correction could not be completed|Forced E2-A audit failure/i);
  assert.equal(await prisma.curriculumCorrection.count({ where: { id: ids.correctionId } }), 0);
  assert.equal(await prisma.subjectOffering.count({ where: { id: ids.replacementOfferingId } }), 0);
  assert.equal(await prisma.subjectOffering.count({ where: { id: sourceId, deletedAt: null } }), 1);
});
