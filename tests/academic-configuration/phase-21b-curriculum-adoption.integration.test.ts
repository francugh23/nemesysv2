import assert from "node:assert/strict";
import { randomInt, randomUUID } from "node:crypto";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { createAuditLogs } from "../../repositories/audit.repository";
import {
  createAdoptedSubjectOffering,
  findDestinationCurriculumAdoptionOfferings,
  findSourceCurriculumAdoptionOfferings,
  type CurriculumAdoptionOffering,
} from "../../repositories/curriculum-adoption.repository";

class RollbackFixture extends Error {}

async function withRollback(run: (tx: Prisma.TransactionClient) => Promise<void>) {
  try {
    await prisma.$transaction(async (tx) => {
      await run(tx);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
}

async function createDestinationYear(tx: Prisma.TransactionClient) {
  const year = randomInt(3000, 9000);
  const academicYear = await tx.academicYear.create({
    data: {
      label: `${year}-${year + 1}`,
      startDate: new Date(`${year}-06-01T00:00:00.000Z`),
      endDate: new Date(`${year + 1}-04-30T00:00:00.000Z`),
    },
    select: { id: true },
  });
  const terms = [];
  for (const [name, position, startDate, endDate] of [
    ["Destination A", 1, `${year}-06-01`, `${year}-09-15`],
    ["Destination B", 2, `${year}-09-16`, `${year}-12-20`],
    ["Destination C", 3, `${year + 1}-01-05`, `${year + 1}-04-30`],
  ] as const) {
    terms.push(await tx.academicTerm.create({
      data: {
        academicYearId: academicYear.id,
        name,
        position,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
      },
      select: { id: true, position: true },
    }));
  }

  return { academicYear, terms };
}

async function createSourceOffering(
  tx: Prisma.TransactionClient,
  values: {
    actorId: string;
    academicYearId: string;
    termIds: string[];
    gradeLevel: "7" | "11" | "12";
    context?: {
      classification: "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE";
      curriculumStatus: "PROVISIONAL_DEPED" | "SCHOOL_APPROVED";
      clusterId?: string;
    };
  },
) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const subject = await tx.subject.create({
    data: {
      code: `P21B-${suffix}`,
      description: `Phase 21B ${suffix}`,
      gradeLevel: values.gradeLevel,
      createdById: values.actorId,
    },
    select: { id: true, code: true, description: true },
  });
  const offering = await tx.subjectOffering.create({
    data: {
      subjectId: subject.id,
      academicYearId: values.academicYearId,
      gradeLevel: values.gradeLevel,
      subjectCode: subject.code,
      subjectDescription: subject.description,
      createdById: values.actorId,
      terms: { create: values.termIds.map((academicTermId) => ({ academicTermId })) },
      shsContext: values.context ? {
        create: {
          classification: values.context.classification,
          curriculumStatus: values.context.curriculumStatus,
          clusterId: values.context.clusterId,
          sourceReference: "Phase 21B source provenance",
          approvalReference: values.context.curriculumStatus === "SCHOOL_APPROVED" ? "Phase 21B approval" : null,
          approvedById: values.context.curriculumStatus === "SCHOOL_APPROVED" ? values.actorId : null,
          approvedAt: values.context.curriculumStatus === "SCHOOL_APPROVED" ? new Date() : null,
          createdById: values.actorId,
        },
      } : undefined,
    },
    select: { id: true },
  });

  return { subject, offering };
}

async function getInvariantCounts(client: Prisma.TransactionClient | typeof prisma) {
  const enrollments = await client.enrollment.count();
  const studentSubjectEnrollments = await client.studentSubjectEnrollment.count();
  const grades = await client.grade.count();
  const assignments = await client.subjectAssignment.count();
  return { enrollments, studentSubjectEnrollments, grades, assignments };
}

test("Phase 21B copies exact mapped Terms, reuses Subjects, and preserves downstream records", async () => {
  await withRollback(async (tx) => {
    const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
    const sourceYear = await tx.academicYear.findFirstOrThrow({
      where: { status: "ACTIVE" },
      select: { id: true, terms: { select: { id: true }, orderBy: { position: "asc" } } },
    });
    assert.equal(sourceYear.terms.length, 3);
    const destination = await createDestinationYear(tx);
    const cluster = await tx.shsCurriculumCluster.create({
      data: {
        code: `P21B-${randomUUID().slice(0, 8)}`,
        name: "Phase 21B Academic cluster",
        track: "ACADEMIC",
        sourceReference: "Phase 21B cluster provenance",
        createdById: actor.id,
      },
      select: { id: true, code: true, name: true },
    });
    const jhs = await createSourceOffering(tx, {
      actorId: actor.id,
      academicYearId: sourceYear.id,
      termIds: sourceYear.terms.map(({ id }) => id),
      gradeLevel: "7",
    });
    const provisional = await createSourceOffering(tx, {
      actorId: actor.id,
      academicYearId: sourceYear.id,
      termIds: [sourceYear.terms[0].id, sourceYear.terms[2].id],
      gradeLevel: "11",
      context: { classification: "CORE", curriculumStatus: "PROVISIONAL_DEPED" },
    });
    const approved = await createSourceOffering(tx, {
      actorId: actor.id,
      academicYearId: sourceYear.id,
      termIds: [sourceYear.terms[1].id],
      gradeLevel: "12",
      context: {
        classification: "ACADEMIC_ELECTIVE",
        curriculumStatus: "SCHOOL_APPROVED",
        clusterId: cluster.id,
      },
    });
    const sourceRows = await findSourceCurriculumAdoptionOfferings(sourceYear.id, tx);
    const byId = new Map(sourceRows.map((row) => [row.id, row]));
    const beforeSubjects = await tx.subject.count();
    const beforeDownstream = await getInvariantCounts(tx);
    const mappedTermIds = new Map([
      [sourceYear.terms[0].id, destination.terms[2].id],
      [sourceYear.terms[1].id, destination.terms[0].id],
      [sourceYear.terms[2].id, destination.terms[1].id],
    ]);

    const copied = [];
    for (const { offering } of [jhs, provisional, approved]) {
      const source = byId.get(offering.id);
      assert.ok(source);
      copied.push(await createAdoptedSubjectOffering(
        source,
        destination.academicYear.id,
        source.terms.map(({ academicTermId }) => mappedTermIds.get(academicTermId)!),
        actor.id,
        tx,
      ));
    }
    const destinationRows = await tx.subjectOffering.findMany({
      where: { id: { in: copied.map(({ id }) => id) } },
      include: {
        terms: { select: { academicTermId: true } },
        shsContext: { include: { cluster: true } },
      },
      orderBy: { gradeLevel: "asc" },
    });

    assert.equal(await tx.subject.count(), beforeSubjects);
    assert.deepEqual(await getInvariantCounts(tx), beforeDownstream);
    assert.deepEqual(
      destinationRows.map(({ subjectId }) => subjectId).sort(),
      [jhs.subject.id, provisional.subject.id, approved.subject.id].sort(),
    );
    assert.deepEqual(
      destinationRows.find(({ gradeLevel }) => gradeLevel === "7")?.terms.map(({ academicTermId }) => academicTermId).sort(),
      destination.terms.map(({ id }) => id).sort(),
    );
    assert.deepEqual(
      destinationRows.find(({ gradeLevel }) => gradeLevel === "11")?.terms.map(({ academicTermId }) => academicTermId).sort(),
      [destination.terms[2].id, destination.terms[1].id].sort(),
    );
    const copiedProvisional = destinationRows.find(({ gradeLevel }) => gradeLevel === "11")?.shsContext;
    assert.equal(copiedProvisional?.classification, "CORE");
    assert.equal(copiedProvisional?.curriculumStatus, "PROVISIONAL_DEPED");
    assert.equal(copiedProvisional?.sourceReference, "Phase 21B source provenance");
    assert.equal(copiedProvisional?.approvalReference, null);
    assert.equal(copiedProvisional?.approvedById, null);
    assert.equal(copiedProvisional?.approvedAt, null);
    const copiedApproved = destinationRows.find(({ gradeLevel }) => gradeLevel === "12")?.shsContext;
    assert.equal(copiedApproved?.classification, "ACADEMIC_ELECTIVE");
    assert.equal(copiedApproved?.clusterId, cluster.id);
    assert.equal(copiedApproved?.cluster?.code, cluster.code);
    assert.equal(copiedApproved?.cluster?.name, cluster.name);
    assert.equal(copiedApproved?.sourceReference, "Phase 21B source provenance");
    assert.equal(copiedApproved?.curriculumStatus, "PROVISIONAL_DEPED");
    assert.equal(copiedApproved?.approvalReference, null);
    assert.equal(copiedApproved?.approvedById, null);
    assert.equal(copiedApproved?.approvedAt, null);

    const sourceAfter = await tx.subjectOffering.findMany({
      where: { id: { in: [jhs.offering.id, provisional.offering.id, approved.offering.id] } },
      include: { terms: true, shsContext: true },
      orderBy: { gradeLevel: "asc" },
    });
    assert.equal(sourceAfter.find(({ gradeLevel }) => gradeLevel === "12")?.shsContext?.curriculumStatus, "SCHOOL_APPROVED");
    assert.deepEqual(
      sourceAfter.find(({ gradeLevel }) => gradeLevel === "7")?.terms.map(({ academicTermId }) => academicTermId).sort(),
      sourceYear.terms.map(({ id }) => id).sort(),
    );
    assert.deepEqual(
      sourceAfter.find(({ gradeLevel }) => gradeLevel === "11")?.terms.map(({ academicTermId }) => academicTermId).sort(),
      [sourceYear.terms[0].id, sourceYear.terms[2].id].sort(),
    );
    assert.deepEqual(
      sourceAfter.find(({ gradeLevel }) => gradeLevel === "12")?.terms.map(({ academicTermId }) => academicTermId),
      [sourceYear.terms[1].id],
    );
  });
});

test("Phase 21B database identity permits replacement of an archived destination identity", async () => {
  await withRollback(async (tx) => {
    const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
    const sourceYear = await tx.academicYear.findFirstOrThrow({
      where: { status: "ACTIVE" },
      select: { id: true, terms: { select: { id: true }, orderBy: { position: "asc" } } },
    });
    const destination = await createDestinationYear(tx);
    const fixture = await createSourceOffering(tx, {
      actorId: actor.id,
      academicYearId: sourceYear.id,
      termIds: sourceYear.terms.map(({ id }) => id),
      gradeLevel: "7",
    });
    const source = (await findSourceCurriculumAdoptionOfferings(sourceYear.id, tx))
      .find(({ id }) => id === fixture.offering.id) as CurriculumAdoptionOffering;
    const first = await createAdoptedSubjectOffering(
      source,
      destination.academicYear.id,
      destination.terms.map(({ id }) => id),
      actor.id,
      tx,
    );

    await tx.subjectOffering.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
    const replacement = await createAdoptedSubjectOffering(
      source,
      destination.academicYear.id,
      destination.terms.map(({ id }) => id),
      actor.id,
      tx,
    );
    const destinationRows = await findDestinationCurriculumAdoptionOfferings(destination.academicYear.id, tx);

    assert.equal(destinationRows.find(({ id }) => id === first.id)?.deletedAt instanceof Date, true);
    assert.equal(destinationRows.find(({ id }) => id === replacement.id)?.deletedAt, null);
  });
});

test("Phase 21B database identity prevents active destination duplicates", async () => {
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
      const sourceYear = await tx.academicYear.findFirstOrThrow({
        where: { status: "ACTIVE" },
        select: { id: true, terms: { select: { id: true }, orderBy: { position: "asc" } } },
      });
      const destination = await createDestinationYear(tx);
      const fixture = await createSourceOffering(tx, {
        actorId: actor.id,
        academicYearId: sourceYear.id,
        termIds: sourceYear.terms.map(({ id }) => id),
        gradeLevel: "7",
      });
      const source = (await findSourceCurriculumAdoptionOfferings(sourceYear.id, tx))
        .find(({ id }) => id === fixture.offering.id) as CurriculumAdoptionOffering;

      await createAdoptedSubjectOffering(source, destination.academicYear.id, destination.terms.map(({ id }) => id), actor.id, tx);
      await createAdoptedSubjectOffering(source, destination.academicYear.id, destination.terms.map(({ id }) => id), actor.id, tx);
    }),
    /unique constraint|SubjectOffering_active_identity_key/i,
  );
});

test("Phase 21B database rejects a foreign destination Term", async () => {
  await withRollback(async (tx) => {
    const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
    const sourceYear = await tx.academicYear.findFirstOrThrow({
      where: { status: "ACTIVE" },
      select: { id: true, terms: { select: { id: true }, orderBy: { position: "asc" } } },
    });
    const destination = await createDestinationYear(tx);
    const fixture = await createSourceOffering(tx, {
      actorId: actor.id,
      academicYearId: sourceYear.id,
      termIds: sourceYear.terms.map(({ id }) => id),
      gradeLevel: "7",
    });
    const source = (await findSourceCurriculumAdoptionOfferings(sourceYear.id, tx))
      .find(({ id }) => id === fixture.offering.id) as CurriculumAdoptionOffering;

    await assert.rejects(
      createAdoptedSubjectOffering(
        source,
        destination.academicYear.id,
        [destination.terms[0].id, destination.terms[1].id, sourceYear.terms[2].id],
        actor.id,
        tx,
      ),
      /must belong to the Offering Academic Year/i,
    );
  });
});

test("Phase 21B source projections expose archived Offerings, Subjects, and SSHS clusters for eligibility checks", async () => {
  await withRollback(async (tx) => {
    const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
    const sourceYear = await tx.academicYear.findFirstOrThrow({
      where: { status: "ACTIVE" },
      select: { id: true, terms: { select: { id: true }, orderBy: { position: "asc" } } },
    });
    const cluster = await tx.shsCurriculumCluster.create({
      data: {
        code: `P21B-${randomUUID().slice(0, 8)}`,
        name: "Phase 21B archived cluster",
        track: "ACADEMIC",
        createdById: actor.id,
      },
      select: { id: true },
    });
    const archivedOffering = await createSourceOffering(tx, {
      actorId: actor.id,
      academicYearId: sourceYear.id,
      termIds: sourceYear.terms.map(({ id }) => id),
      gradeLevel: "7",
    });
    const archivedSubject = await createSourceOffering(tx, {
      actorId: actor.id,
      academicYearId: sourceYear.id,
      termIds: [sourceYear.terms[0].id],
      gradeLevel: "11",
      context: { classification: "CORE", curriculumStatus: "PROVISIONAL_DEPED" },
    });
    const archivedCluster = await createSourceOffering(tx, {
      actorId: actor.id,
      academicYearId: sourceYear.id,
      termIds: [sourceYear.terms[1].id],
      gradeLevel: "12",
      context: {
        classification: "ACADEMIC_ELECTIVE",
        curriculumStatus: "PROVISIONAL_DEPED",
        clusterId: cluster.id,
      },
    });
    await tx.subjectOffering.update({ where: { id: archivedOffering.offering.id }, data: { deletedAt: new Date() } });
    await tx.subject.update({ where: { id: archivedSubject.subject.id }, data: { deletedAt: new Date() } });
    await tx.shsCurriculumCluster.update({ where: { id: cluster.id }, data: { deletedAt: new Date() } });

    const rows = await findSourceCurriculumAdoptionOfferings(sourceYear.id, tx);

    assert.ok(rows.find(({ id }) => id === archivedOffering.offering.id)?.deletedAt);
    assert.ok(rows.find(({ id }) => id === archivedSubject.offering.id)?.subject.deletedAt);
    assert.ok(rows.find(({ id }) => id === archivedCluster.offering.id)?.shsContext?.cluster?.deletedAt);
  });
});

test("Phase 21B adoption and audit writes roll back completely when audit persistence fails", async () => {
  const destinationYearId = randomUUID();
  const destinationOfferingIds: string[] = [];

  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
      const sourceYear = await tx.academicYear.findFirstOrThrow({
        where: { status: "ACTIVE" },
        select: { id: true, terms: { select: { id: true }, orderBy: { position: "asc" } } },
      });
      const year = randomInt(3000, 9000);
      await tx.academicYear.create({
        data: {
          id: destinationYearId,
          label: `${year}-${year + 1}`,
          startDate: new Date(`${year}-06-01T00:00:00.000Z`),
          endDate: new Date(`${year + 1}-04-30T00:00:00.000Z`),
        },
      });
      const destinationTerms = [];
      for (const [index] of sourceYear.terms.entries()) {
        destinationTerms.push(await tx.academicTerm.create({
          data: {
            academicYearId: destinationYearId,
            name: `Rollback Term ${index + 1}`,
            position: index + 1,
            startDate: new Date(`${year + (index === 2 ? 1 : 0)}-${index === 0 ? "06-01" : index === 1 ? "09-16" : "01-05"}T00:00:00.000Z`),
            endDate: new Date(`${year + (index === 2 ? 1 : 0)}-${index === 0 ? "09-15" : index === 1 ? "12-20" : "04-30"}T00:00:00.000Z`),
          },
          select: { id: true },
        }));
      }
      const fixture = await createSourceOffering(tx, {
        actorId: actor.id,
        academicYearId: sourceYear.id,
        termIds: sourceYear.terms.map(({ id }) => id),
        gradeLevel: "7",
      });
      const source = (await findSourceCurriculumAdoptionOfferings(sourceYear.id, tx))
        .find(({ id }) => id === fixture.offering.id) as CurriculumAdoptionOffering;
      const destination = await createAdoptedSubjectOffering(
        source,
        destinationYearId,
        destinationTerms.map(({ id }) => id),
        actor.id,
        tx,
      );
      destinationOfferingIds.push(destination.id);

      await createAuditLogs([{
        userId: randomUUID(),
        action: "ADOPT",
        module: "SubjectOfferingAdoption",
        description: "Forced audit foreign-key failure",
      }], tx);
    }),
    /foreign key constraint|AuditLog_userId_fkey/i,
  );

  assert.equal(await prisma.academicYear.count({ where: { id: destinationYearId } }), 0);
  assert.equal(await prisma.subjectOffering.count({ where: { id: { in: destinationOfferingIds } } }), 0);
  assert.equal(await prisma.auditLog.count({ where: { description: "Forced audit foreign-key failure" } }), 0);
});
