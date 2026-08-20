import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { createAuditLogs } from "../../repositories/audit.repository";
import {
  dropShsStudentSubjectEnrollmentInTransaction,
  progressShsCurrentTermInTransaction,
} from "../../services/student-subject-enrollment-selection.service";
import {
  finalizeShsTermResultInTransaction,
  saveShsTermResultDraftInTransaction,
} from "../../services/shs-term-result-mutation.service";

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

async function createActiveFixture(transaction: Prisma.TransactionClient) {
  const actor = await transaction.user.findFirstOrThrow({
    where: { deletedAt: null, role: "SUPER_ADMIN" },
    select: { id: true },
  });
  await transaction.academicYear.updateMany({
    where: { status: "ACTIVE" },
    data: { status: "LOCKED" },
  });

  const startYear = randomInt(7000, 8500);
  const academicYear = await transaction.academicYear.create({
    data: {
      label: `${startYear}-${startYear + 1}`,
      startDate: new Date(`${startYear}-06-01T00:00:00.000Z`),
      endDate: new Date(`${startYear + 1}-04-30T00:00:00.000Z`),
      createdById: actor.id,
    },
    select: { id: true, label: true },
  });
  const termData = [
    ["Term 1", 1, `${startYear}-06-01`, `${startYear}-09-15`],
    ["Term 2", 2, `${startYear}-09-16`, `${startYear}-12-20`],
    ["Term 3", 3, `${startYear + 1}-01-05`, `${startYear + 1}-04-30`],
  ] as const;
  const terms = [];
  for (const [name, position, startDate, endDate] of termData) {
    terms.push(await transaction.academicTerm.create({
      data: {
        academicYearId: academicYear.id,
        name,
        position,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        createdById: actor.id,
      },
      select: { id: true, name: true, startDate: true, endDate: true },
    }));
  }
  await transaction.academicYear.update({
    where: { id: academicYear.id },
    data: { status: "ACTIVE" },
  });

  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const jhsSubject = await transaction.subject.create({
    data: {
      code: `E1-JHS-${suffix}`,
      description: "E1 JHS fixture",
      gradeLevel: "7",
      createdById: actor.id,
    },
    select: { id: true },
  });
  const jhsOffering = await transaction.subjectOffering.create({
    data: {
      subjectId: jhsSubject.id,
      academicYearId: academicYear.id,
      gradeLevel: "7",
      subjectCode: `E1-JHS-${suffix}`,
      subjectDescription: "E1 JHS fixture",
      createdById: actor.id,
      terms: { create: terms.map(({ id }) => ({ academicTermId: id })) },
    },
    select: { id: true },
  });

  const cluster = await transaction.shsCurriculumCluster.create({
    data: {
      code: `E1-${suffix}`,
      name: "E1 school cluster",
      track: "ACADEMIC",
      createdById: actor.id,
    },
    select: { id: true, code: true },
  });
  const shsSubject = await transaction.subject.create({
    data: {
      code: `E1-SHS-${suffix}`,
      description: "E1 SHS fixture",
      gradeLevel: "11",
      createdById: actor.id,
    },
    select: { id: true },
  });
  const shsOffering = await transaction.subjectOffering.create({
    data: {
      subjectId: shsSubject.id,
      academicYearId: academicYear.id,
      gradeLevel: "11",
      subjectCode: `E1-SHS-${suffix}`,
      subjectDescription: "E1 SHS fixture",
      createdById: actor.id,
      terms: { create: { academicTermId: terms[0].id } },
      shsContext: {
        create: {
          classification: "ACADEMIC_ELECTIVE",
          curriculumStatus: "SCHOOL_APPROVED",
          clusterId: cluster.id,
          sourceReference: "E1 source",
          approvalReference: "E1 approval",
          approvedById: actor.id,
          approvedAt: new Date(),
          createdById: actor.id,
        },
      },
    },
    select: { id: true },
  });

  return { actor, academicYear, terms, jhsOffering, cluster, shsOffering };
}

let savepointSequence = 0;

async function expectDatabaseRejection(
  transaction: Prisma.TransactionClient,
  operation: Promise<unknown>,
  pattern: RegExp,
) {
  const savepoint = `phase21e_e1_${savepointSequence += 1}`;
  await transaction.$executeRawUnsafe(`SAVEPOINT ${savepoint}`);
  let rejected: unknown;
  try {
    await operation;
  } catch (error) {
    rejected = error;
    await transaction.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  }
  await transaction.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`);
  assert.ok(rejected, "Expected the database operation to be rejected.");
  assert.match(String(rejected), pattern);
}

test("finalization is ACTIVE-only, one-time, and blocked by Pending School Approval", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createActiveFixture(transaction);
    const pendingSubject = await transaction.subject.create({
      data: {
        code: `E1-P-${randomUUID().slice(0, 8)}`,
        description: "Pending E1 fixture",
        gradeLevel: "12",
        createdById: fixture.actor.id,
      },
      select: { id: true, code: true },
    });
    const pending = await transaction.subjectOffering.create({
      data: {
        subjectId: pendingSubject.id,
        academicYearId: fixture.academicYear.id,
        gradeLevel: "12",
        subjectCode: pendingSubject.code,
        subjectDescription: "Pending E1 fixture",
        createdById: fixture.actor.id,
        terms: { create: { academicTermId: fixture.terms[1].id } },
        shsContext: {
          create: {
            classification: "CORE",
            curriculumStatus: "PROVISIONAL_DEPED",
            sourceReference: "Pending E1 source",
            createdById: fixture.actor.id,
          },
        },
      },
      select: { id: true },
    });

    await expectDatabaseRejection(
      transaction,
      transaction.curriculumFinalization.create({
        data: { academicYearId: fixture.academicYear.id, finalizedById: fixture.actor.id, finalizedAt: new Date() },
      }),
      /Pending or invalid SHS Offerings/i,
    );
    await transaction.subjectOffering.update({ where: { id: pending.id }, data: { deletedAt: new Date() } });

    const finalization = await transaction.curriculumFinalization.create({
      data: { academicYearId: fixture.academicYear.id, finalizedById: fixture.actor.id, finalizedAt: new Date() },
    });
    assert.ok(finalization.id);
    assert.equal((await transaction.academicYear.findUniqueOrThrow({ where: { id: fixture.academicYear.id } })).status, "ACTIVE");
    assert.equal(await transaction.shsElectiveEnrollmentPolicy.count({ where: { academicYearId: fixture.academicYear.id } }), 0);

    await expectDatabaseRejection(
      transaction,
      transaction.curriculumFinalization.create({
        data: { academicYearId: fixture.academicYear.id, finalizedById: fixture.actor.id, finalizedAt: new Date() },
      }),
      /already exists|Unique constraint/i,
    );
    await expectDatabaseRejection(
      transaction,
      transaction.curriculumFinalization.update({ where: { id: finalization.id }, data: { finalizedAt: new Date() } }),
      /immutable/i,
    );
  });
});

test("DRAFT, LOCKED, and ARCHIVED Academic Years cannot be finalized", async () => {
  await withRollback(async (transaction) => {
    const actor = await transaction.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
    for (const [index, status] of (["DRAFT", "LOCKED", "ARCHIVED"] as const).entries()) {
      const year = 8600 + index * 2;
      const academicYear = await transaction.academicYear.create({
        data: {
          label: `${year}-${year + 1}`,
          startDate: new Date(`${year}-06-01T00:00:00.000Z`),
          endDate: new Date(`${year + 1}-04-30T00:00:00.000Z`),
          status,
          createdById: actor.id,
        },
      });
      await expectDatabaseRejection(
        transaction,
        transaction.curriculumFinalization.create({
          data: { academicYearId: academicYear.id, finalizedById: actor.id, finalizedAt: new Date() },
        }),
        /only for an active Academic Year/i,
      );
    }
  });
});

test("finalized Curriculum blocks direct Offering, Term, context, approval, archive, policy, and cluster changes", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createActiveFixture(transaction);
    await transaction.curriculumFinalization.create({
      data: { academicYearId: fixture.academicYear.id, finalizedById: fixture.actor.id, finalizedAt: new Date() },
    });

    await expectDatabaseRejection(
      transaction,
      transaction.subjectOffering.update({ where: { id: fixture.jhsOffering.id }, data: { subjectDescription: "Changed" } }),
      /Finalized Curriculum/i,
    );
    await expectDatabaseRejection(
      transaction,
      transaction.subjectOfferingTerm.delete({
        where: { subjectOfferingId_academicTermId: { subjectOfferingId: fixture.jhsOffering.id, academicTermId: fixture.terms[0].id } },
      }),
      /Finalized Curriculum Term/i,
    );
    await expectDatabaseRejection(
      transaction,
      transaction.subjectOfferingShsContext.update({ where: { subjectOfferingId: fixture.shsOffering.id }, data: { sourceReference: "Changed" } }),
      /Finalized SHS Curriculum/i,
    );
    await expectDatabaseRejection(
      transaction,
      transaction.subjectOffering.update({ where: { id: fixture.jhsOffering.id }, data: { deletedAt: new Date() } }),
      /Finalized Curriculum/i,
    );
    await expectDatabaseRejection(
      transaction,
      transaction.shsElectiveEnrollmentPolicy.create({
        data: {
          academicYearId: fixture.academicYear.id,
          academicTermId: fixture.terms[0].id,
          gradeLevel: "11",
          minimumElectives: 1,
          maximumElectives: 3,
          createdById: fixture.actor.id,
        },
      }),
      /Finalized Curriculum elective policies/i,
    );
    await expectDatabaseRejection(
      transaction,
      transaction.shsCurriculumCluster.update({ where: { id: fixture.cluster.id }, data: { name: "Renamed" } }),
      /finalized Curriculum cannot be renamed/i,
    );
    await expectDatabaseRejection(
      transaction,
      transaction.academicTerm.update({ where: { id: fixture.terms[0].id }, data: { name: "Changed Term" } }),
      /only for a draft Academic Year/i,
    );
  });
});

test("student dependency freezes semantic configuration but still permits pre-finalization archive", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createActiveFixture(transaction);
    const section = await transaction.section.create({
      data: { gradeLevel: "7", sectionName: `E1 dependency ${randomUUID().slice(0, 8)}`, createdById: fixture.actor.id },
    });
    const student = await transaction.student.create({
      data: {
        lrn: randomUUID().replaceAll("-", "").slice(0, 12),
        firstName: "E1",
        lastName: "Dependency",
        gender: "FEMALE",
        barangay: "Test",
        municipality: "Test",
        province: "Test",
        createdById: fixture.actor.id,
      },
    });
    const enrollment = await transaction.enrollment.create({
      data: {
        studentId: student.id,
        sectionId: section.id,
        academicYearId: fixture.academicYear.id,
        createdById: fixture.actor.id,
      },
    });
    const depended = await transaction.subjectOffering.findUniqueOrThrow({
      where: { id: fixture.jhsOffering.id },
      select: { id: true, subjectCode: true, subjectDescription: true, gradeLevel: true, terms: { select: { academicTermId: true } } },
    });
    await transaction.studentSubjectEnrollment.create({
      data: {
        enrollmentId: enrollment.id,
        subjectOfferingId: depended.id,
        subjectCode: depended.subjectCode,
        subjectDescription: depended.subjectDescription,
        gradeLevel: depended.gradeLevel,
        createdById: fixture.actor.id,
        terms: { create: depended.terms.map(({ academicTermId }) => ({ academicTermId })) },
      },
    });
    await expectDatabaseRejection(
      transaction,
      transaction.subjectOffering.update({ where: { id: depended.id }, data: { subjectDescription: `${depended.subjectDescription} changed` } }),
      /used by student participation/i,
    );
    await expectDatabaseRejection(
      transaction,
      transaction.subjectOfferingTerm.delete({
        where: { subjectOfferingId_academicTermId: { subjectOfferingId: depended.id, academicTermId: depended.terms[0].academicTermId } },
      }),
      /used by student participation/i,
    );
    await transaction.subjectOffering.update({ where: { id: depended.id }, data: { deletedAt: new Date() } });

    const unrelated = await transaction.subjectOffering.findUniqueOrThrow({
      where: { id: fixture.shsOffering.id },
      select: { id: true, subjectDescription: true },
    });
    await transaction.subjectOffering.update({
      where: { id: unrelated.id },
      data: { subjectDescription: `${unrelated.subjectDescription} safe correction` },
    });
  });
});

test("SHS approval, used policy scopes, Terms, and active cluster references are protected", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createActiveFixture(transaction);
    const approved = await transaction.subjectOfferingShsContext.findUniqueOrThrow({
      where: { subjectOfferingId: fixture.shsOffering.id },
      include: { cluster: true, subjectOffering: true },
    });
    await expectDatabaseRejection(
      transaction,
      transaction.subjectOfferingShsContext.update({ where: { subjectOfferingId: approved.subjectOfferingId }, data: { approvalReference: "Rewritten" } }),
      /approval is immutable|used by student participation/i,
    );
    await expectDatabaseRejection(
      transaction,
      transaction.subjectOfferingShsContext.update({ where: { subjectOfferingId: approved.subjectOfferingId }, data: { curriculumStatus: "PROVISIONAL_DEPED", approvalReference: null, approvedById: null, approvedAt: null } }),
      /approval is immutable|used by student participation/i,
    );

    const section = await transaction.section.create({
      data: { gradeLevel: "11", sectionName: `E1 policy ${randomUUID().slice(0, 8)}`, createdById: fixture.actor.id },
    });
    const student = await transaction.student.create({
      data: {
        lrn: randomUUID().replaceAll("-", "").slice(0, 12),
        firstName: "E1",
        lastName: "Policy",
        gender: "FEMALE",
        barangay: "Test",
        municipality: "Test",
        province: "Test",
        createdById: fixture.actor.id,
      },
    });
    const enrollment = await transaction.enrollment.create({
      data: {
        studentId: student.id,
        sectionId: section.id,
        academicYearId: fixture.academicYear.id,
        entryAcademicTermId: fixture.terms[0].id,
        shsTrack: "ACADEMIC",
        createdById: fixture.actor.id,
      },
    });
    await transaction.studentSubjectEnrollment.create({
      data: {
        enrollmentId: enrollment.id,
        subjectOfferingId: fixture.shsOffering.id,
        selectionAcademicTermId: fixture.terms[0].id,
        subjectCode: approved.subjectOffering.subjectCode,
        subjectDescription: approved.subjectOffering.subjectDescription,
        gradeLevel: approved.subjectOffering.gradeLevel,
        shsClassification: approved.classification,
        shsClusterCode: approved.cluster?.code,
        shsClusterName: approved.cluster?.name,
        shsCurriculumStatus: approved.curriculumStatus,
        shsSourceReference: approved.sourceReference,
        shsApprovalReference: approved.approvalReference,
        createdById: fixture.actor.id,
        terms: { create: { academicTermId: fixture.terms[0].id } },
      },
    });
    await expectDatabaseRejection(
      transaction,
      transaction.shsElectiveEnrollmentPolicy.create({
        data: {
          academicYearId: fixture.academicYear.id,
          academicTermId: fixture.terms[0].id,
          gradeLevel: "11",
          minimumElectives: 1,
          maximumElectives: 3,
          createdById: fixture.actor.id,
        },
      }),
      /policy scope used by student participation/i,
    );

    const activeTerm = await transaction.academicTerm.findUniqueOrThrow({ where: { id: fixture.terms[0].id } });
    await expectDatabaseRejection(
      transaction,
      transaction.academicTerm.update({ where: { id: activeTerm.id }, data: { name: `${activeTerm.name} changed` } }),
      /only for a draft Academic Year/i,
    );

    await expectDatabaseRejection(
      transaction,
      transaction.shsCurriculumCluster.update({ where: { id: fixture.cluster.id }, data: { deletedAt: new Date() } }),
      /used by active Curriculum/i,
    );
  });
});

test("Enrollment, SHS progression, DROP, and Term Results continue after Curriculum finalization", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createActiveFixture(transaction);
    const term = fixture.terms[0];
    await transaction.shsElectiveEnrollmentPolicy.create({
      data: {
        academicYearId: fixture.academicYear.id,
        academicTermId: term.id,
        gradeLevel: "11",
        minimumElectives: 1,
        maximumElectives: 1,
        createdById: fixture.actor.id,
      },
    });
    const section = await transaction.section.create({
      data: {
        gradeLevel: "11",
        sectionName: `E1-${randomUUID().slice(0, 8)}`,
        createdById: fixture.actor.id,
      },
      select: { id: true },
    });
    const student = await transaction.student.create({
      data: {
        lrn: randomUUID().replaceAll("-", "").slice(0, 12),
        firstName: "E1",
        lastName: "Student",
        gender: "FEMALE",
        barangay: "Test",
        municipality: "Test",
        province: "Test",
        createdById: fixture.actor.id,
      },
      select: { id: true },
    });
    const enrollment = await transaction.enrollment.create({
      data: {
        studentId: student.id,
        sectionId: section.id,
        academicYearId: fixture.academicYear.id,
        entryAcademicTermId: term.id,
        shsTrack: "ACADEMIC",
        createdById: fixture.actor.id,
      },
      select: { id: true },
    });
    await transaction.curriculumFinalization.create({
      data: { academicYearId: fixture.academicYear.id, finalizedById: fixture.actor.id, finalizedAt: new Date() },
    });

    const termStart = () => new Date(`${term.startDate.toISOString().slice(0, 10)}T04:00:00.000Z`);
    await progressShsCurrentTermInTransaction(
      { enrollmentId: enrollment.id, subjectOfferingIds: [fixture.shsOffering.id] },
      fixture.actor.id,
      transaction,
      termStart,
    );
    const participation = await transaction.studentSubjectEnrollment.findFirstOrThrow({
      where: { enrollmentId: enrollment.id, subjectOfferingId: fixture.shsOffering.id, status: "ACTIVE" },
      select: { id: true },
    });
    const resultIdentity = {
      enrollmentId: enrollment.id,
      studentSubjectEnrollmentId: participation.id,
      academicTermId: term.id,
    };
    const termEnd = () => new Date(`${term.endDate.toISOString().slice(0, 10)}T04:00:00.000Z`);
    await saveShsTermResultDraftInTransaction(
      { ...resultIdentity, finalResult: 88 },
      fixture.actor.id,
      transaction,
      termEnd,
    );
    const result = await finalizeShsTermResultInTransaction(
      resultIdentity,
      fixture.actor.id,
      transaction,
      termEnd,
    );
    assert.equal(result.status, "FINALIZED");

    const dropped = await dropShsStudentSubjectEnrollmentInTransaction(
      { enrollmentId: enrollment.id, studentSubjectEnrollmentId: participation.id, reason: "Documented E1 test DROP" },
      fixture.actor.id,
      transaction,
      termStart,
    );
    assert.equal(dropped.dropped.status, "DROPPED");
  });
});

test("finalization and its audit roll back together when audit persistence fails", async () => {
  const finalizationId = randomUUID();
  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const fixture = await createActiveFixture(transaction);
      await transaction.curriculumFinalization.create({
        data: {
          id: finalizationId,
          academicYearId: fixture.academicYear.id,
          finalizedById: fixture.actor.id,
          finalizedAt: new Date(),
        },
      });
      await createAuditLogs([{
        userId: "missing-e1-audit-actor",
        action: "FINALIZE",
        module: "CurriculumFinalization",
        recordId: finalizationId,
        description: "Forced E1 audit rollback.",
      }], transaction);
    }),
  );
  assert.equal(await prisma.curriculumFinalization.count({ where: { id: finalizationId } }), 0);
});
