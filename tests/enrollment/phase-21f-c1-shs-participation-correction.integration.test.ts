import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { correctShsStudentParticipationInTransaction } from "../../services/shs-student-participation-correction-mutation.service";
import { createLegacyPolicyFixture, makeLegacyActiveCurriculumConfigurable } from "../helpers/phase-21e-e1-legacy-fixture";

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
async function rejected(
  transaction: Prisma.TransactionClient,
  operation: () => Promise<unknown>,
  pattern: RegExp,
) {
  const savepoint = `phase21f_c1_${savepointSequence += 1}`;
  await transaction.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  try {
    await operation();
    assert.fail("Expected rejection.");
  } catch (error) {
    assert.match(String(error), pattern);
  } finally {
    // PostgreSQL marks the transaction aborted after a trigger error.
    await transaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await transaction.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

type Kind = "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE";

async function fixture(
  transaction: Prisma.TransactionClient,
  kind: Kind,
  options: { sourceTerms?: number[]; replacementTerms?: number[]; policy?: [number, number] } = {},
) {
  const actor = await transaction.user.findFirstOrThrow({
    where: { deletedAt: null, status: "ACTIVE" }, select: { id: true },
  });
  const academicYear = await transaction.academicYear.findFirstOrThrow({
    where: { status: "ACTIVE" },
    select: { id: true, terms: { select: { id: true, position: true }, orderBy: { position: "asc" } } },
  });
  assert.equal(academicYear.terms.length, 3, "C1 requires the active three-Term Academic Year");
  await makeLegacyActiveCurriculumConfigurable(academicYear.id, transaction, true);

  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const cluster = kind === "CORE" ? null : await transaction.shsCurriculumCluster.create({
    data: {
      code: `C1${kind === "ACADEMIC_ELECTIVE" ? "A" : "T"}${suffix}`,
      name: `C1 ${kind} cluster`,
      track: kind === "ACADEMIC_ELECTIVE" ? "ACADEMIC" : "TECHPRO",
      createdById: actor.id,
    },
  });
  const createOffering = async (label: string, positions: number[], replacesSubjectOfferingId?: string) => {
    const subject = await transaction.subject.create({
      data: { code: `C1${label}${suffix}`, description: `C1 ${label} ${kind}`, gradeLevel: "11", createdById: actor.id },
    });
    return transaction.subjectOffering.create({
      data: {
        subjectId: subject.id,
        academicYearId: academicYear.id,
        gradeLevel: "11",
        subjectCode: subject.code,
        subjectDescription: subject.description,
        createdById: actor.id,
        replacesSubjectOfferingId,
        terms: { create: academicYear.terms.filter(({ position }) => positions.includes(position)).map(({ id }) => ({ academicTermId: id })) },
        shsContext: { create: {
          classification: kind,
          curriculumStatus: "SCHOOL_APPROVED",
          clusterId: cluster?.id,
          sourceReference: `C1 ${label} source`,
          approvalReference: `C1 ${label} approval`,
          approvedById: actor.id,
          approvedAt: new Date(),
          createdById: actor.id,
        } },
      },
      include: { shsContext: { include: { cluster: true } } },
    });
  };
  const sourcePositions = options.sourceTerms ?? (kind === "CORE" ? [1, 2, 3] : [2]);
  const replacementPositions = options.replacementTerms ?? sourcePositions;
  const sourceOffering = await createOffering("SOURCE", sourcePositions);
  const replacementOffering = await createOffering("REPLACEMENT", replacementPositions);
  const section = await transaction.section.create({ data: { gradeLevel: "11", sectionName: `C1 ${suffix}`, createdById: actor.id } });
  const student = await transaction.student.create({
    data: { lrn: `C1${suffix}`, firstName: "C1", lastName: "Correction", gender: "FEMALE", barangay: "Test", municipality: "Test", province: "Test", createdById: actor.id },
  });
  const enrollment = await transaction.enrollment.create({
    data: { studentId: student.id, sectionId: section.id, academicYearId: academicYear.id, entryAcademicTermId: academicYear.terms[0]!.id, shsTrack: "ACADEMIC", createdById: actor.id },
  });
  const source = await transaction.studentSubjectEnrollment.create({
    data: {
      enrollmentId: enrollment.id, subjectOfferingId: sourceOffering.id,
      selectionAcademicTermId: kind === "CORE" ? null : academicYear.terms.find(({ position }) => position === sourcePositions[0])!.id,
      subjectCode: sourceOffering.subjectCode, subjectDescription: sourceOffering.subjectDescription, gradeLevel: "11",
      shsClassification: kind, shsClusterCode: sourceOffering.shsContext?.cluster?.code ?? null,
      shsClusterName: sourceOffering.shsContext?.cluster?.name ?? null, shsCurriculumStatus: "SCHOOL_APPROVED",
      shsSourceReference: sourceOffering.shsContext!.sourceReference, shsApprovalReference: sourceOffering.shsContext!.approvalReference,
      createdById: actor.id,
      terms: { create: academicYear.terms.filter(({ position }) => sourcePositions.includes(position)).map(({ id }) => ({ academicTermId: id })) },
    }, include: { terms: true },
  });
  const affectedTerm = academicYear.terms.find(({ position }) => position === (kind === "CORE" ? 2 : sourcePositions[0]))!;
  if (kind !== "CORE") {
    const [minimumElectives, maximumElectives] = options.policy ?? [1, 2];
    await createLegacyPolicyFixture({
      academicYearId: academicYear.id, academicTermId: affectedTerm.id, gradeLevel: "11", minimumElectives, maximumElectives, createdById: actor.id,
    }, transaction);
  }
  return { actor, academicYear, enrollment, source, sourceOffering, replacementOffering, affectedTerm, cluster };
}

function values(data: Awaited<ReturnType<typeof fixture>>) {
  return {
    sourceStudentSubjectEnrollmentId: data.source.id,
    sourceAcademicTermId: data.affectedTerm.id,
    replacementSubjectOfferingId: data.replacementOffering.id,
    reason: "Registrar verified immutable SHS participation was assigned to the wrong subject.",
    evidenceReference: "C1-INT-001",
    confirmed: true as const,
  };
}

test("C1 corrects Core only from the affected Term forward and retains source history", async () => {
  await withRollback(async (transaction) => {
    const data = await fixture(transaction, "CORE");
    const result = await correctShsStudentParticipationInTransaction(data.enrollment.id, values(data), data.actor.id, transaction);
    const [source, replacement, correction] = await Promise.all([
      transaction.studentSubjectEnrollment.findUniqueOrThrow({ where: { id: data.source.id }, include: { terms: true } }),
      transaction.studentSubjectEnrollment.findUniqueOrThrow({ where: { id: result.replacementStudentSubjectEnrollmentId }, include: { terms: true } }),
      transaction.shsStudentParticipationCorrection.findUniqueOrThrow({ where: { id: result.correctionId } }),
    ]);
    assert.equal(source.status, "REPLACED");
    assert.deepEqual(source.terms.map(({ academicTermId }) => academicTermId), data.academicYear.terms.map(({ id }) => id));
    assert.equal(replacement.status, "ACTIVE");
    assert.deepEqual(replacement.terms.map(({ academicTermId }) => academicTermId).sort(), data.academicYear.terms.slice(1).map(({ id }) => id).sort());
    assert.equal(correction.kind, "CORE");
  });
});

for (const kind of ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"] as const) {
  test(`C1 ${kind} correction preserves exact one-Term elective identity`, async () => {
    await withRollback(async (transaction) => {
      const data = await fixture(transaction, kind);
      const result = await correctShsStudentParticipationInTransaction(data.enrollment.id, values(data), data.actor.id, transaction);
      const replacement = await transaction.studentSubjectEnrollment.findUniqueOrThrow({ where: { id: result.replacementStudentSubjectEnrollmentId }, include: { terms: true } });
      assert.equal(replacement.selectionAcademicTermId, data.affectedTerm.id);
      assert.deepEqual(replacement.terms.map(({ academicTermId }) => academicTermId), [data.affectedTerm.id]);
    });
  });
}

test("C1 rejects results, classification/cluster and Offering-Term mismatches, policy bounds, and active duplicates without writes", async () => {
  await withRollback(async (transaction) => {
    const data = await fixture(transaction, "ACADEMIC_ELECTIVE");
    await transaction.shsTermResult.create({ data: { studentSubjectEnrollmentId: data.source.id, academicTermId: data.affectedTerm.id, createdById: data.actor.id } });
    await rejected(transaction, () => correctShsStudentParticipationInTransaction(data.enrollment.id, values(data), data.actor.id, transaction), /results must be corrected separately/);
  });
  await withRollback(async (transaction) => {
    const data = await fixture(transaction, "ACADEMIC_ELECTIVE", { replacementTerms: [1] });
    await rejected(transaction, () => correctShsStudentParticipationInTransaction(data.enrollment.id, values(data), data.actor.id, transaction), /exact safe correction Term scope/);
  });
  await withRollback(async (transaction) => {
    const data = await fixture(transaction, "ACADEMIC_ELECTIVE", { policy: [2, 2] });
    await rejected(transaction, () => correctShsStudentParticipationInTransaction(data.enrollment.id, values(data), data.actor.id, transaction), /outside the approved policy range/);
  });
  await withRollback(async (transaction) => {
    const data = await fixture(transaction, "ACADEMIC_ELECTIVE");
    await transaction.studentSubjectEnrollment.create({ data: {
      enrollmentId: data.enrollment.id, subjectOfferingId: data.replacementOffering.id, selectionAcademicTermId: data.affectedTerm.id,
      subjectCode: data.replacementOffering.subjectCode, subjectDescription: data.replacementOffering.subjectDescription, gradeLevel: "11",
      shsClassification: "ACADEMIC_ELECTIVE", shsClusterCode: data.cluster!.code, shsClusterName: data.cluster!.name,
      shsCurriculumStatus: "SCHOOL_APPROVED", shsSourceReference: data.replacementOffering.shsContext!.sourceReference,
      shsApprovalReference: data.replacementOffering.shsContext!.approvalReference, createdById: data.actor.id,
      terms: { create: [{ academicTermId: data.affectedTerm.id }] },
    } });
    await rejected(transaction, () => correctShsStudentParticipationInTransaction(data.enrollment.id, values(data), data.actor.id, transaction), /already has active participation/);
  });
});

test("C1 migration blocks generic replacement, forged/replayed capabilities, event mutation, Term and result mutation, and cross-domain composition", async () => {
  await withRollback(async (transaction) => {
    const data = await fixture(transaction, "CORE");
    await rejected(transaction, () => transaction.studentSubjectEnrollment.update({
      where: { id: data.source.id }, data: { status: "REPLACED", replacedAt: new Date() },
    }), /exact active participation correction mapping/);

    const result = await correctShsStudentParticipationInTransaction(data.enrollment.id, values(data), data.actor.id, transaction);
    const correction = await transaction.shsStudentParticipationCorrection.findUniqueOrThrow({ where: { id: result.correctionId } });
    await rejected(transaction, () => transaction.shsStudentParticipationCorrection.update({ where: { id: correction.id }, data: { reason: "forged" } }), /immutable/);
    await rejected(transaction, () => transaction.studentSubjectEnrollmentTerm.delete({ where: {
      studentSubjectEnrollmentId_academicTermId: { studentSubjectEnrollmentId: data.source.id, academicTermId: data.affectedTerm.id },
    } }), /exact source, replacement, Term, and result evidence|cannot mutate old Terms|history cannot be hard-deleted/);
    await rejected(transaction, async () => {
      await transaction.shsTermResult.create({ data: {
        studentSubjectEnrollmentId: result.replacementStudentSubjectEnrollmentId, academicTermId: data.affectedTerm.id, createdById: data.actor.id,
      } });
      await transaction.$executeRawUnsafe('SET CONSTRAINTS "ShsStudentParticipationCorrection_result_revalidation_trigger" IMMEDIATE');
    }, /exact source, replacement, Term, and result evidence/);
    await transaction.$queryRaw`SELECT set_config('nemesys.shs_student_participation_correction_id', ${randomUUID()}, true)`;
    await transaction.$queryRawUnsafe("SET LOCAL nemesys.shs_progressive_core_replacement_id = 'forged-cross-domain'");
    await rejected(transaction, () => transaction.studentSubjectEnrollment.update({
      where: { id: result.replacementStudentSubjectEnrollmentId }, data: { status: "REPLACED", replacedAt: new Date() },
    }), /exact active participation correction mapping/);
  });
});
