import { randomInt, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { findSourceCurriculumAdoptionOfferings } from "../../repositories/curriculum-adoption.repository";
import { findOfferingReplacementAncestors } from "../../repositories/student-subject-enrollment.repository";
import { getCurriculumAdoptionInvalidReasons } from "../../services/curriculum-adoption-eligibility.service";
import { correctSubjectOfferingInTransaction } from "../../services/curriculum-correction.service";
import { progressShsCurrentTermInTransaction } from "../../services/student-subject-enrollment-selection.service";
import type { CorrectSubjectOfferingInput } from "../../schemas";
import { createLegacyPolicyFixture } from "../helpers/phase-21e-e1-legacy-fixture";

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

async function configureGapBefore(position: 2 | 3, academicYearId: string, transaction: Prisma.TransactionClient) {
  const terms = await transaction.academicTerm.findMany({ where: { academicYearId }, orderBy: { position: "asc" } });
  assert.equal(terms.length, 3);
  const today = new Date();
  const day = (offset: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + offset));
  await transaction.$executeRawUnsafe('ALTER TABLE "AcademicTerm" DISABLE TRIGGER "AcademicTerm_enforce_draft_year_trigger"');
  try {
    if (position === 2) {
      await transaction.academicTerm.update({ where: { id: terms[0]!.id }, data: { endDate: day(-1) } });
      await transaction.academicTerm.update({ where: { id: terms[1]!.id }, data: { startDate: day(1) } });
    } else {
      await transaction.academicTerm.update({ where: { id: terms[0]!.id }, data: { endDate: day(-70) } });
      await transaction.academicTerm.update({ where: { id: terms[1]!.id }, data: { startDate: day(-69), endDate: day(-1) } });
      await transaction.academicTerm.update({ where: { id: terms[2]!.id }, data: { startDate: day(1) } });
    }
  } finally {
    await transaction.$executeRawUnsafe('ALTER TABLE "AcademicTerm" ENABLE TRIGGER "AcademicTerm_enforce_draft_year_trigger"');
  }
}

type Classification = "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE";

async function sourceFixture(classification: Classification, effectivePosition: 2 | 3, transaction: Prisma.TransactionClient) {
  const source = await transaction.subjectOffering.findFirst({
    where: {
      deletedAt: null,
      gradeLevel: "11",
      academicYear: { status: "ACTIVE", curriculumFinalization: { isNot: null } },
      sourceCurriculumCorrection: null,
      shsContext: { classification, curriculumStatus: "SCHOOL_APPROVED" },
      terms: { some: { academicTerm: { position: effectivePosition } } },
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
      academicYear: { select: { terms: { select: { id: true, name: true, position: true }, orderBy: { position: "asc" } } } },
      terms: { select: { academicTermId: true, academicTerm: { select: { position: true } } } },
    },
  });
  assert.ok(source, `Expected approved ${classification} fixture for Term ${effectivePosition}.`);
  await configureGapBefore(effectivePosition, source.academicYearId, transaction);
  const effectiveTerm = source.academicYear.terms.find(({ position }) => position === effectivePosition)!;
  return { source, effectiveTerm };
}

async function createEnrollmentWithParticipation(
  source: Awaited<ReturnType<typeof sourceFixture>>["source"],
  entryAcademicTermId: string,
  participationTermIds: string[],
  transaction: Prisma.TransactionClient,
) {
  const section = await transaction.section.create({
    data: { gradeLevel: "11", trackStrand: "Academic", sectionName: `E2B-${randomUUID()}`, createdById: source.createdById },
  });
  const student = await transaction.student.create({
    data: {
      lrn: String(randomInt(100_000_000_000, 999_999_999_999)),
      firstName: "E2B",
      lastName: "Prospective",
      gender: "MALE",
      barangay: "Test",
      municipality: "Test",
      province: "Test",
      status: "ENROLLED",
      currentSectionId: section.id,
      createdById: source.createdById,
    },
  });
  const enrollment = await transaction.enrollment.create({
    data: {
      studentId: student.id,
      sectionId: section.id,
      academicYearId: source.academicYearId,
      entryAcademicTermId,
      shsTrack: "ACADEMIC",
      status: "ACTIVE",
      createdById: source.createdById,
    },
  });
  if (participationTermIds.length) {
    await transaction.studentSubjectEnrollment.create({
      data: {
        enrollmentId: enrollment.id,
        subjectOfferingId: source.id,
        subjectCode: source.subjectCode,
        subjectDescription: source.subjectDescription,
        gradeLevel: source.gradeLevel,
        shsClassification: source.shsContext!.classification,
        shsClusterCode: source.shsContext!.cluster?.code ?? null,
        shsClusterName: source.shsContext!.cluster?.name ?? null,
        shsCurriculumStatus: source.shsContext!.curriculumStatus,
        shsSourceReference: source.shsContext!.sourceReference,
        shsApprovalReference: source.shsContext!.approvalReference,
        createdById: source.createdById,
        terms: { create: participationTermIds.map((academicTermId) => ({ academicTermId })) },
      },
    });
  }
  return enrollment.id;
}

async function activateTerm(academicTermId: string, transaction: Prisma.TransactionClient) {
  const today = new Date();
  const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  await transaction.$executeRawUnsafe('ALTER TABLE "AcademicTerm" DISABLE TRIGGER "AcademicTerm_enforce_draft_year_trigger"');
  try {
    await transaction.academicTerm.update({ where: { id: academicTermId }, data: { startDate } });
  } finally {
    await transaction.$executeRawUnsafe('ALTER TABLE "AcademicTerm" ENABLE TRIGGER "AcademicTerm_enforce_draft_year_trigger"');
  }
}

async function ensurePolicies(source: Awaited<ReturnType<typeof sourceFixture>>["source"], termIds: string[], transaction: Prisma.TransactionClient) {
  for (const academicTermId of termIds) {
    const existing = await transaction.shsElectiveEnrollmentPolicy.findUnique({
      where: { academicYearId_academicTermId_gradeLevel: { academicYearId: source.academicYearId, academicTermId, gradeLevel: "11" } },
    });
    if (!existing) {
      await createLegacyPolicyFixture({
        academicYearId: source.academicYearId,
        academicTermId,
        gradeLevel: "11",
        minimumElectives: 1,
        maximumElectives: 3,
        createdById: source.createdById,
      }, transaction);
    }
  }
}

async function correctionValues(
  source: Awaited<ReturnType<typeof sourceFixture>>["source"],
  effectiveTermId: string,
  target: Classification,
  transaction: Prisma.TransactionClient,
): Promise<CorrectSubjectOfferingInput> {
  const effectivePosition = source.academicYear.terms.find(({ id }) => id === effectiveTermId)!.position;
  const termIds = source.terms.filter(({ academicTerm }) => academicTerm.position >= effectivePosition).map(({ academicTermId }) => academicTermId);
  let clusterId: string | undefined;
  if (target !== "CORE") {
    const track = target === "ACADEMIC_ELECTIVE" ? "ACADEMIC" : "TECHPRO";
    clusterId = (await transaction.shsCurriculumCluster.findFirstOrThrow({
      where: { track, deletedAt: null, isSchoolFacing: true },
      select: { id: true },
    })).id;
    await ensurePolicies(source, termIds, transaction);
  }
  return {
    sourceOfferingId: source.id,
    effectiveAcademicTermId: effectiveTermId,
    reason: "Phase 21E-E2-B prospective school Curriculum correction.",
    evidenceReference: "E2-B correction evidence",
    confirmation: source.subjectCode,
    replacement: {
      subjectId: source.subjectId,
      gradeLevel: "11",
      academicTermIds: termIds,
      shsContext: {
        classification: target,
        clusterId,
        sourceReference: "New E2-B successor provenance",
        approvalReference: "New E2-B correction approval",
      },
    },
  };
}

type DirectCorrectionFacts = {
  sourceReference: string | null;
  approvalReference: string | null;
  approvedById: string;
  approvedAt: Date;
};

async function attemptDirectCoreCorrection(
  override: (defaults: DirectCorrectionFacts, fixture: {
    source: Awaited<ReturnType<typeof sourceFixture>>["source"];
    otherActorId: string;
    correctedAt: Date;
  }) => DirectCorrectionFacts,
  options: { clearProtocolContext?: boolean } = {},
) {
  return prisma.$transaction(async (transaction) => {
    const { source, effectiveTerm } = await sourceFixture("CORE", 2, transaction);
    const correctedAt = new Date();
    const correctionId = randomUUID();
    const replacementOfferingId = randomUUID();
    const otherActorId = (await transaction.user.findFirstOrThrow({
      where: { id: { not: source.createdById }, deletedAt: null },
      select: { id: true },
    })).id;
    const facts = override({
      sourceReference: "Direct E2-B provenance",
      approvalReference: "Direct E2-B approval",
      approvedById: source.createdById,
      approvedAt: correctedAt,
    }, { source, otherActorId, correctedAt });
    const [{ snapshot: sourceSnapshot }] = await transaction.$queryRaw<Array<{ snapshot: Prisma.JsonValue }>>`
      SELECT "CurriculumCorrection_offering_snapshot"(${source.id}) AS snapshot
    `;
    const replacementTerms = source.academicYear.terms.filter(({ position }) => position >= effectiveTerm.position);
    const replacementSnapshot = {
      subjectId: source.subjectId,
      subjectCode: source.subjectCode,
      subjectDescription: source.subjectDescription,
      gradeLevel: source.gradeLevel,
      terms: replacementTerms.map((term) => ({ id: term.id, name: term.name, position: term.position })),
      shsContext: {
        classification: "CORE",
        curriculumStatus: "SCHOOL_APPROVED",
        clusterId: null,
        clusterCode: null,
        clusterName: null,
        sourceReference: facts.sourceReference,
        approvalReference: facts.approvalReference,
        approvedById: facts.approvedById,
        approvedAt: facts.approvedAt.toISOString(),
      },
    } satisfies Prisma.InputJsonObject;
    const sourceParticipationCount = await transaction.studentSubjectEnrollment.count({ where: { subjectOfferingId: source.id } });

    await transaction.$queryRaw`SELECT set_config('nemesys.curriculum_correction_id', ${correctionId}, true)`;
    await transaction.curriculumCorrection.create({
      data: {
        id: correctionId,
        academicYearId: source.academicYearId,
        sourceOfferingId: source.id,
        replacementOfferingId,
        effectiveAcademicTermId: effectiveTerm.id,
        reason: "Direct database completion-guard test",
        evidenceReference: "E2-B direct-write evidence",
        sourceWasFinalized: true,
        sourceParticipationCount,
        sourceConfigurationSnapshot: sourceSnapshot as Prisma.InputJsonValue,
        replacementConfigurationSnapshot: replacementSnapshot,
        correctedById: source.createdById,
        correctedAt,
      },
    });
    if (options.clearProtocolContext) {
      await transaction.$queryRaw`SELECT set_config('nemesys.curriculum_correction_id', '', true)`;
    }
    await transaction.subjectOffering.update({ where: { id: source.id }, data: { deletedAt: correctedAt } });
    await transaction.subjectOffering.create({
      data: {
        id: replacementOfferingId,
        subjectId: source.subjectId,
        academicYearId: source.academicYearId,
        gradeLevel: source.gradeLevel,
        subjectCode: source.subjectCode,
        subjectDescription: source.subjectDescription,
        createdById: source.createdById,
        replacesSubjectOfferingId: source.id,
        terms: { create: replacementTerms.map(({ id }) => ({ academicTermId: id })) },
        shsContext: {
          create: {
            classification: "CORE",
            curriculumStatus: "SCHOOL_APPROVED",
            sourceReference: facts.sourceReference,
            approvalReference: facts.approvalReference,
            approvedById: facts.approvedById,
            approvedAt: facts.approvedAt,
            createdById: source.createdById,
          },
        },
      },
    });
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
  });
}

test("E2-B Core correction derives exact remaining Terms and rejects later, omitted, added, and pre-effective Terms", async () => {
  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await sourceFixture("CORE", 2, transaction);
    const valid = await correctionValues(source, effectiveTerm.id, "CORE", transaction);
    const term1 = source.academicYear.terms.find(({ position }) => position === 1)!;
    const term3 = source.academicYear.terms.find(({ position }) => position === 3)!;
    await assert.rejects(
      correctSubjectOfferingInTransaction({ ...valid, effectiveAcademicTermId: term3.id, replacement: { ...valid.replacement, academicTermIds: [term3.id] } }, source.createdById, transaction),
      /immediately next unstarted/i,
    );
    await assert.rejects(
      correctSubjectOfferingInTransaction({ ...valid, replacement: { ...valid.replacement, academicTermIds: [effectiveTerm.id] } }, source.createdById, transaction),
      /exactly match/i,
    );
    await assert.rejects(
      correctSubjectOfferingInTransaction({ ...valid, replacement: { ...valid.replacement, academicTermIds: [...valid.replacement.academicTermIds, term1.id] } }, source.createdById, transaction),
      /exactly match/i,
    );
    const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    await correctSubjectOfferingInTransaction(valid, source.createdById, transaction, () => new Date(), ids);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    const successor = await transaction.subjectOffering.findUniqueOrThrow({ where: { id: ids.replacementOfferingId }, include: { terms: true, shsContext: true } });
    assert.deepEqual(successor.terms.map(({ academicTermId }) => academicTermId).sort(), [effectiveTerm.id, term3.id].sort());
    assert.equal(successor.shsContext?.curriculumStatus, "SCHOOL_APPROVED");
    assert.equal(successor.shsContext?.sourceReference, "New E2-B successor provenance");
    assert.equal(successor.shsContext?.approvalReference, "New E2-B correction approval");
  });
});

test("E2-B permits every approved prospective classification transition without changing policy rows", async () => {
  const transitions: Array<[Classification, Classification]> = [
    ["CORE", "CORE"],
    ["CORE", "ACADEMIC_ELECTIVE"],
    ["CORE", "TECHPRO_ELECTIVE"],
    ["ACADEMIC_ELECTIVE", "ACADEMIC_ELECTIVE"],
    ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"],
    ["TECHPRO_ELECTIVE", "TECHPRO_ELECTIVE"],
    ["TECHPRO_ELECTIVE", "ACADEMIC_ELECTIVE"],
    ["ACADEMIC_ELECTIVE", "CORE"],
    ["TECHPRO_ELECTIVE", "CORE"],
  ];
  for (const [sourceClassification, targetClassification] of transitions) {
    await withRollback(async (transaction) => {
      const { source, effectiveTerm } = await sourceFixture(sourceClassification, 2, transaction);
      const values = await correctionValues(source, effectiveTerm.id, targetClassification, transaction);
      const policiesBefore = await transaction.shsElectiveEnrollmentPolicy.findMany({ where: { academicYearId: source.academicYearId }, orderBy: { id: "asc" } });
      const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
      await correctSubjectOfferingInTransaction(values, source.createdById, transaction, () => new Date(), ids);
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
      const successor = await transaction.subjectOfferingShsContext.findUniqueOrThrow({ where: { subjectOfferingId: ids.replacementOfferingId }, include: { cluster: true } });
      assert.equal(successor.classification, targetClassification);
      assert.equal(successor.cluster?.track ?? null, targetClassification === "CORE" ? null : targetClassification === "ACADEMIC_ELECTIVE" ? "ACADEMIC" : "TECHPRO");
      assert.deepEqual(await transaction.shsElectiveEnrollmentPolicy.findMany({ where: { academicYearId: source.academicYearId }, orderBy: { id: "asc" } }), policiesBefore);
    });
  }
});

test("E2-B rejects an elective successor when any remaining-Term policy is missing", async () => {
  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await sourceFixture("CORE", 2, transaction);
    const values = await correctionValues(source, effectiveTerm.id, "ACADEMIC_ELECTIVE", transaction);
    const missingTermId = values.replacement.academicTermIds.at(-1)!;
    await transaction.$executeRawUnsafe('ALTER TABLE "ShsElectiveEnrollmentPolicy" DISABLE TRIGGER "ShsElectiveEnrollmentPolicy_enforce_curriculum_lock_trigger"');
    await transaction.shsElectiveEnrollmentPolicy.delete({ where: { academicYearId_academicTermId_gradeLevel: { academicYearId: source.academicYearId, academicTermId: missingTermId, gradeLevel: "11" } } });
    await transaction.$executeRawUnsafe('ALTER TABLE "ShsElectiveEnrollmentPolicy" ENABLE TRIGGER "ShsElectiveEnrollmentPolicy_enforce_curriculum_lock_trigger"');
    await assert.rejects(
      correctSubjectOfferingInTransaction(values, source.createdById, transaction),
      /policy configuration must cover every replacement Term/i,
    );
  });
});

test("E2-B rejects incompatible elective clusters and copied approval evidence", async () => {
  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await sourceFixture("CORE", 2, transaction);
    const values = await correctionValues(source, effectiveTerm.id, "ACADEMIC_ELECTIVE", transaction);
    const techProCluster = await transaction.shsCurriculumCluster.findFirstOrThrow({
      where: { track: "TECHPRO", deletedAt: null, isSchoolFacing: true },
      select: { id: true },
    });
    await assert.rejects(
      correctSubjectOfferingInTransaction({
        ...values,
        replacement: { ...values.replacement, shsContext: { ...values.replacement.shsContext!, clusterId: techProCluster.id } },
      }, source.createdById, transaction),
      /Academic curriculum cluster/i,
    );
  });

  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await sourceFixture("CORE", 2, transaction);
    const values = await correctionValues(source, effectiveTerm.id, "CORE", transaction);
    await assert.rejects(
      correctSubjectOfferingInTransaction({
        ...values,
        replacement: {
          ...values.replacement,
          shsContext: { ...values.replacement.shsContext!, approvalReference: source.shsContext!.approvalReference! },
        },
      }, source.createdById, transaction),
      /independently evidence/i,
    );
  });
});

test("E2-B database rejects reused successor provenance and approval evidence", async () => {
  await assert.rejects(
    attemptDirectCoreCorrection((facts, { source }) => ({ ...facts, sourceReference: source.shsContext!.sourceReference })),
    /requires newly supplied provenance/i,
  );
  await assert.rejects(
    attemptDirectCoreCorrection((facts, { source }) => ({ ...facts, approvalReference: source.shsContext!.approvalReference })),
    /requires independent approval evidence/i,
  );
  await assert.rejects(
    attemptDirectCoreCorrection((facts, { source }) => ({ ...facts, sourceReference: `  ${source.shsContext!.sourceReference}  ` })),
    /requires newly supplied provenance/i,
  );
  await assert.rejects(
    attemptDirectCoreCorrection((facts, { source }) => ({ ...facts, approvalReference: `  ${source.shsContext!.approvalReference}  ` })),
    /requires independent approval evidence/i,
  );
});

test("E2-B database rejects absent successor approval evidence", async () => {
  await assert.rejects(
    attemptDirectCoreCorrection((facts) => ({ ...facts, approvalReference: null })),
    /approval|check constraint/i,
  );
});

test("E2-B database rejects correction approval facts that do not match the correction event", async () => {
  await assert.rejects(
    attemptDirectCoreCorrection((facts, { otherActorId }) => ({ ...facts, approvedById: otherActorId })),
    /approval facts must match the correction actor and timestamp/i,
  );
  await assert.rejects(
    attemptDirectCoreCorrection((facts, { correctedAt }) => ({ ...facts, approvedAt: new Date(correctedAt.getTime() + 1_000) })),
    /approval facts must match the correction actor and timestamp/i,
  );
});

test("E2-B direct writes cannot bypass the scoped correction protocol", async () => {
  await assert.rejects(
    attemptDirectCoreCorrection((facts) => facts, { clearProtocolContext: true }),
    /Correction-linked Curriculum Offerings are immutable/i,
  );
});

test("E2-B adoption excludes partial-year successors but retains ordinary one-Term successors", async () => {
  await withRollback(async (transaction) => {
    const core = await sourceFixture("CORE", 2, transaction);
    const coreValues = await correctionValues(core.source, core.effectiveTerm.id, "CORE", transaction);
    const coreIds = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    await correctSubjectOfferingInTransaction(coreValues, core.source.createdById, transaction, () => new Date(), coreIds);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
    const coreRow = (await findSourceCurriculumAdoptionOfferings(core.source.academicYearId, transaction)).find(({ id }) => id === coreIds.replacementOfferingId)!;
    assert.ok(getCurriculumAdoptionInvalidReasons(coreRow).some(({ code }) => code === "PARTIAL_YEAR_CORRECTION_SUCCESSOR"));
  });

  await withRollback(async (transaction) => {
    const elective = await sourceFixture("ACADEMIC_ELECTIVE", 2, transaction);
    assert.equal(elective.source.terms.length, 1);
    const values = await correctionValues(elective.source, elective.effectiveTerm.id, "ACADEMIC_ELECTIVE", transaction);
    const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    await correctSubjectOfferingInTransaction(values, elective.source.createdById, transaction, () => new Date(), ids);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    const row = (await findSourceCurriculumAdoptionOfferings(elective.source.academicYearId, transaction)).find(({ id }) => id === ids.replacementOfferingId)!;
    assert.equal(getCurriculumAdoptionInvalidReasons(row).some(({ code }) => code === "PARTIAL_YEAR_CORRECTION_SUCCESSOR"), false);
  });
});

test("E2-B late entry materializes only the same-class Core successor's remaining Terms", async () => {
  for (const effectivePosition of [2, 3] as const) {
    await withRollback(async (transaction) => {
      const { source, effectiveTerm } = await sourceFixture("CORE", effectivePosition, transaction);
      const values = await correctionValues(source, effectiveTerm.id, "CORE", transaction);
      const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
      await correctSubjectOfferingInTransaction(values, source.createdById, transaction, () => new Date(), ids);
      await ensurePolicies(source, [effectiveTerm.id], transaction);
      const enrollmentId = await createEnrollmentWithParticipation(source, effectiveTerm.id, [], transaction);
      const elective = await transaction.subjectOffering.findFirstOrThrow({
        where: {
          academicYearId: source.academicYearId,
          gradeLevel: "11",
          deletedAt: null,
          terms: { some: { academicTermId: effectiveTerm.id } },
          shsContext: { curriculumStatus: "SCHOOL_APPROVED", classification: { in: ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"] }, cluster: { deletedAt: null } },
        },
        select: { id: true },
      });
      await activateTerm(effectiveTerm.id, transaction);
      await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
      await progressShsCurrentTermInTransaction({ enrollmentId, subjectOfferingIds: [elective.id] }, source.createdById, transaction);
      const successor = await transaction.studentSubjectEnrollment.findFirstOrThrow({
        where: { enrollmentId, subjectOfferingId: ids.replacementOfferingId },
        select: { terms: { select: { academicTermId: true }, orderBy: { academicTerm: { position: "asc" } } } },
      });
      assert.deepEqual(successor.terms.map(({ academicTermId }) => academicTermId), values.replacement.academicTermIds);
      const earlierIds = source.academicYear.terms.filter(({ position }) => position < effectivePosition).map(({ id }) => id);
      assert.equal(successor.terms.some(({ academicTermId }) => earlierIds.includes(academicTermId)), false);
    });
  }
});

test("E2-B does not reuse Core ancestor coverage across a Core-to-elective classification change", async () => {
  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await sourceFixture("CORE", 2, transaction);
    const firstTerm = source.academicYear.terms.find(({ position }) => position === 1)!;
    const enrollmentId = await createEnrollmentWithParticipation(source, firstTerm.id, [firstTerm.id], transaction);
    const values = await correctionValues(source, effectiveTerm.id, "ACADEMIC_ELECTIVE", transaction);
    const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    await correctSubjectOfferingInTransaction(values, source.createdById, transaction, () => new Date(), ids);
    await activateTerm(effectiveTerm.id, transaction);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
    const result = await progressShsCurrentTermInTransaction(
      { enrollmentId, subjectOfferingIds: [ids.replacementOfferingId] },
      source.createdById,
      transaction,
    );
    assert.equal(result.createdElectives, 1);
    assert.equal(result.retainedElectives, 0);
    assert.equal(await transaction.studentSubjectEnrollment.count({ where: { enrollmentId, subjectOfferingId: source.id } }), 1);
    assert.equal(await transaction.studentSubjectEnrollment.count({ where: { enrollmentId, subjectOfferingId: ids.replacementOfferingId } }), 1);
  });
});

test("E2-B does not reuse or DROP-block elective ancestry across an elective-to-Core classification change", async () => {
  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await sourceFixture("ACADEMIC_ELECTIVE", 2, transaction);
    const enrollmentId = await createEnrollmentWithParticipation(source, effectiveTerm.id, [effectiveTerm.id], transaction);
    await transaction.studentSubjectEnrollment.updateMany({
      where: { enrollmentId, subjectOfferingId: source.id, status: "ACTIVE" },
      data: { status: "DROPPED", droppedAt: new Date(), dropReason: "E2-B classification boundary" },
    });
    const values = await correctionValues(source, effectiveTerm.id, "CORE", transaction);
    const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    await correctSubjectOfferingInTransaction(values, source.createdById, transaction, () => new Date(), ids);
    await ensurePolicies(source, [effectiveTerm.id], transaction);
    const elective = await transaction.subjectOffering.findFirstOrThrow({
      where: {
        id: { not: source.id },
        academicYearId: source.academicYearId,
        gradeLevel: "11",
        deletedAt: null,
        terms: { some: { academicTermId: effectiveTerm.id } },
        shsContext: { curriculumStatus: "SCHOOL_APPROVED", classification: { in: ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"] }, cluster: { deletedAt: null } },
      },
      select: { id: true },
    });
    await activateTerm(effectiveTerm.id, transaction);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
    await progressShsCurrentTermInTransaction({ enrollmentId, subjectOfferingIds: [elective.id] }, source.createdById, transaction);
    assert.equal(await transaction.studentSubjectEnrollment.count({
      where: { enrollmentId, subjectOfferingId: ids.replacementOfferingId, status: "ACTIVE" },
    }), 1);
  });
});

test("E2-B repeated same-class chain resolves every compatible ancestor", async () => {
  await withRollback(async (transaction) => {
    const first = await sourceFixture("CORE", 2, transaction);
    const firstValues = await correctionValues(first.source, first.effectiveTerm.id, "CORE", transaction);
    const firstIds = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    await correctSubjectOfferingInTransaction(firstValues, first.source.createdById, transaction, () => new Date(), firstIds);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");

    await configureGapBefore(3, first.source.academicYearId, transaction);
    const secondSource = await transaction.subjectOffering.findUniqueOrThrow({
      where: { id: firstIds.replacementOfferingId },
      select: {
        id: true,
        subjectId: true,
        subjectCode: true,
        subjectDescription: true,
        gradeLevel: true,
        academicYearId: true,
        createdById: true,
        shsContext: { include: { cluster: true } },
        academicYear: { select: { terms: { select: { id: true, name: true, position: true }, orderBy: { position: "asc" } } } },
        terms: { select: { academicTermId: true, academicTerm: { select: { position: true } } } },
      },
    });
    const term3 = secondSource.academicYear.terms.find(({ position }) => position === 3)!;
    const secondValues = await correctionValues(secondSource, term3.id, "CORE", transaction);
    secondValues.replacement.shsContext!.sourceReference = "New E2-B chain successor provenance";
    secondValues.replacement.shsContext!.approvalReference = "New E2-B chain correction approval";
    const secondIds = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    await correctSubjectOfferingInTransaction(secondValues, secondSource.createdById, transaction, () => new Date(), secondIds);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL IMMEDIATE");
    const lineage = await findOfferingReplacementAncestors([secondIds.replacementOfferingId], transaction);
    assert.deepEqual(new Set(lineage.map(({ ancestorOfferingId }) => ancestorOfferingId)), new Set([first.source.id, firstIds.replacementOfferingId]));
  });
});

test("E2-B blocks a descendant elective after an ancestor was dropped", async () => {
  await withRollback(async (transaction) => {
    const { source, effectiveTerm } = await sourceFixture("TECHPRO_ELECTIVE", 2, transaction);
    const firstTerm = source.academicYear.terms.find(({ position }) => position === 1)!;
    const enrollmentId = await createEnrollmentWithParticipation(source, firstTerm.id, [firstTerm.id], transaction);
    await transaction.studentSubjectEnrollment.updateMany({
      where: { enrollmentId, subjectOfferingId: source.id, status: "ACTIVE" },
      data: { status: "DROPPED", droppedAt: new Date(), dropReason: "Documented ancestor DROP" },
    });
    const values = await correctionValues(source, effectiveTerm.id, "ACADEMIC_ELECTIVE", transaction);
    const ids = { correctionId: randomUUID(), replacementOfferingId: randomUUID() };
    await correctSubjectOfferingInTransaction(values, source.createdById, transaction, () => new Date(), ids);
    await activateTerm(effectiveTerm.id, transaction);
    await transaction.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED");
    await assert.rejects(
      progressShsCurrentTermInTransaction({ enrollmentId, subjectOfferingIds: [ids.replacementOfferingId] }, source.createdById, transaction),
      /replacement descendants remain blocked/i,
    );
    assert.equal(await transaction.studentSubjectEnrollment.count({ where: { enrollmentId, subjectOfferingId: ids.replacementOfferingId } }), 0);
  });
});
