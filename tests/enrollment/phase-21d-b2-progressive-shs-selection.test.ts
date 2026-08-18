import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import {
  progressShsCurrentTermInTransaction,
  ShsCurrentTermProgressionError,
} from "../../services/student-subject-enrollment-selection.service";

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

function clockFor(term: { startDate: Date }) {
  return () => new Date(term.startDate.getTime() + 12 * 60 * 60 * 1000);
}

async function createProgressionFixture(
  transaction: Prisma.TransactionClient,
  options: {
    entryPosition?: number;
    policyPosition?: number;
    minimumElectives?: number;
    maximumElectives?: number;
    createPolicy?: boolean;
  } = {},
) {
  const entryPosition = options.entryPosition ?? 1;
  const policyPosition = options.policyPosition ?? entryPosition;
  const [actor, academicYear] = await Promise.all([
    transaction.user.findFirstOrThrow({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true },
    }),
    transaction.academicYear.findFirstOrThrow({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        terms: {
          select: { id: true, position: true, startDate: true, endDate: true },
          orderBy: { position: "asc" },
        },
      },
    }),
  ]);
  assert.equal(academicYear.terms.length, 3, "B2 fixtures require the active three-Term year");

  const provisionalOfferings = await transaction.subjectOffering.findMany({
    where: {
      academicYearId: academicYear.id,
      gradeLevel: "11",
      deletedAt: null,
      shsContext: { is: { curriculumStatus: "PROVISIONAL_DEPED" } },
    },
    select: {
      id: true,
      subjectCode: true,
      terms: {
        select: { academicTermId: true, academicTerm: { select: { position: true } } },
        orderBy: { academicTerm: { position: "asc" } },
      },
      shsContext: {
        select: {
          classification: true,
          cluster: { select: { deletedAt: true } },
        },
      },
    },
  });
  const cores = provisionalOfferings.filter(
    ({ shsContext }) => shsContext?.classification === "CORE",
  );
  const academicByPosition = new Map(
    academicYear.terms.map((term) => [
      term.position,
      provisionalOfferings.find(
        (offering) =>
          offering.shsContext?.classification === "ACADEMIC_ELECTIVE" &&
          offering.shsContext.cluster?.deletedAt === null &&
          offering.terms.some(({ academicTerm }) => academicTerm.position === term.position),
      ),
    ]),
  );
  const techPro = provisionalOfferings.find(
    (offering) =>
      offering.shsContext?.classification === "TECHPRO_ELECTIVE" &&
      offering.shsContext.cluster?.deletedAt === null &&
      academicYear.terms.every((term) =>
        offering.terms.some(({ academicTerm }) => academicTerm.position === term.position),
      ),
  );
  assert.ok(cores.length > 0, "active AY must retain provisional Grade 11 Core Offerings");
  assert.ok(techPro, "active AY must retain a three-Term provisional TechPro Offering");
  for (const term of academicYear.terms) {
    assert.ok(
      academicByPosition.get(term.position),
      `active AY must retain a provisional Academic elective for Term ${term.position}`,
    );
  }

  const approvedIds = [
    ...cores.map(({ id }) => id),
    ...academicByPosition.values().map((offering) => offering!.id),
    techPro.id,
  ];
  await transaction.subjectOfferingShsContext.updateMany({
    where: {
      subjectOfferingId: { in: approvedIds },
      curriculumStatus: "PROVISIONAL_DEPED",
    },
    data: {
      curriculumStatus: "SCHOOL_APPROVED",
      approvalReference: `Phase 21D-B2 rollback fixture ${randomUUID()}`,
      approvedById: actor.id,
      approvedAt: new Date("2026-08-18T00:00:00.000Z"),
    },
  });

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const [section, student] = await Promise.all([
    transaction.section.create({
      data: { gradeLevel: "11", sectionName: `B2 progression ${suffix}`, createdById: actor.id },
      select: { id: true },
    }),
    transaction.student.create({
      data: {
        lrn: `B2P${suffix}`,
        firstName: "Progressive",
        lastName: "Selection",
        gender: "FEMALE",
        barangay: "Test",
        municipality: "Test",
        province: "Test",
        createdById: actor.id,
      },
      select: { id: true },
    }),
  ]);
  const entryTerm = academicYear.terms.find(({ position }) => position === entryPosition)!;
  const policyTerm = academicYear.terms.find(({ position }) => position === policyPosition)!;
  const enrollment = await transaction.enrollment.create({
    data: {
      studentId: student.id,
      sectionId: section.id,
      academicYearId: academicYear.id,
      entryAcademicTermId: entryTerm.id,
      shsTrack: "ACADEMIC",
      createdById: actor.id,
    },
    select: { id: true },
  });
  const policy = options.createPolicy === false
    ? null
    : await transaction.shsElectiveEnrollmentPolicy.create({
        data: {
          academicYearId: academicYear.id,
          academicTermId: policyTerm.id,
          gradeLevel: "11",
          minimumElectives: options.minimumElectives ?? 1,
          maximumElectives: options.maximumElectives ?? 3,
          createdById: actor.id,
        },
      });

  return {
    actor,
    academicYear,
    enrollment,
    entryTerm,
    policyTerm,
    policy,
    cores,
    academicByPosition,
    techPro,
  };
}

for (const entryPosition of [1, 2, 3]) {
  test(`initial entry in Term ${entryPosition} starts Core at entry and creates no prior Core Terms`, async () => {
    await withRollback(async (transaction) => {
      const fixture = await createProgressionFixture(transaction, { entryPosition });
      const elective = fixture.academicByPosition.get(entryPosition)!;
      const beforeAudits = await transaction.auditLog.count({
        where: { module: "StudentSubjectEnrollment" },
      });
      const result = await progressShsCurrentTermInTransaction(
        { enrollmentId: fixture.enrollment.id, subjectOfferingIds: [elective.id] },
        fixture.actor.id,
        transaction,
        clockFor(fixture.entryTerm),
      );
      const rows = await transaction.studentSubjectEnrollment.findMany({
        where: { enrollmentId: fixture.enrollment.id },
        include: { terms: { include: { academicTerm: true } } },
      });
      const coreRows = rows.filter(({ shsClassification }) => shsClassification === "CORE");
      const electiveRow = rows.find(({ subjectOfferingId }) => subjectOfferingId === elective.id);

      assert.equal(result.createdElectives, 1);
      assert.equal(result.currentAcademicTermId, fixture.entryTerm.id);
      assert.equal(coreRows.length >= fixture.cores.length, true);
      assert.equal(
        coreRows.every(({ selectionAcademicTermId }) => selectionAcademicTermId === null),
        true,
      );
      assert.equal(
        coreRows.every(({ terms }) =>
          terms.every(({ academicTerm }) => academicTerm.position >= entryPosition),
        ),
        true,
      );
      assert.deepEqual(electiveRow?.terms.map(({ academicTermId }) => academicTermId), [
        fixture.entryTerm.id,
      ]);
      assert.equal(electiveRow?.selectionAcademicTermId, fixture.entryTerm.id);
      assert.equal(
        await transaction.auditLog.count({ where: { module: "StudentSubjectEnrollment" } }),
        beforeAudits + result.createdCore + result.createdElectives,
      );
    });
  });
}

test("initial materialization rejects a current Term different from the Enrollment entry Term", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createProgressionFixture(transaction, {
      entryPosition: 1,
      policyPosition: 2,
    });
    const term2 = fixture.academicYear.terms[1]!;
    await assert.rejects(
      progressShsCurrentTermInTransaction(
        {
          enrollmentId: fixture.enrollment.id,
          subjectOfferingIds: [fixture.academicByPosition.get(2)!.id],
        },
        fixture.actor.id,
        transaction,
        clockFor(term2),
      ),
      (error: unknown) =>
        error instanceof ShsCurrentTermProgressionError && /entry Academic Term/.test(error.message),
    );
    assert.equal(
      await transaction.studentSubjectEnrollment.count({
        where: { enrollmentId: fixture.enrollment.id },
      }),
      0,
    );
  });
});

test("selection is current-Term only and rejects a future-Term Academic elective", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createProgressionFixture(transaction, { entryPosition: 1 });
    await assert.rejects(
      progressShsCurrentTermInTransaction(
        {
          enrollmentId: fixture.enrollment.id,
          subjectOfferingIds: [fixture.academicByPosition.get(2)!.id],
        },
        fixture.actor.id,
        transaction,
        clockFor(fixture.entryTerm),
      ),
      /approved for the current Academic Term/,
    );
  });
});

test("selection is additive and an identical retry is idempotent", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createProgressionFixture(transaction, {
      minimumElectives: 1,
      maximumElectives: 3,
    });
    const academic = fixture.academicByPosition.get(1)!;
    const first = await progressShsCurrentTermInTransaction(
      { enrollmentId: fixture.enrollment.id, subjectOfferingIds: [academic.id] },
      fixture.actor.id,
      transaction,
      clockFor(fixture.entryTerm),
    );
    const additive = await progressShsCurrentTermInTransaction(
      {
        enrollmentId: fixture.enrollment.id,
        subjectOfferingIds: [academic.id, fixture.techPro.id],
      },
      fixture.actor.id,
      transaction,
      clockFor(fixture.entryTerm),
    );
    const retry = await progressShsCurrentTermInTransaction(
      {
        enrollmentId: fixture.enrollment.id,
        subjectOfferingIds: [academic.id, fixture.techPro.id],
      },
      fixture.actor.id,
      transaction,
      clockFor(fixture.entryTerm),
    );

    assert.equal(first.createdElectives, 1);
    assert.equal(additive.createdElectives, 1);
    assert.equal(additive.retainedElectives, 1);
    assert.deepEqual(retry, {
      createdCore: 0,
      replacedCore: 0,
      createdElectives: 0,
      retainedElectives: 2,
      currentElectiveCount: 2,
      currentAcademicTermId: fixture.entryTerm.id,
    });
    assert.equal(
      await transaction.studentSubjectEnrollment.count({
        where: {
          enrollmentId: fixture.enrollment.id,
          status: "ACTIVE",
          shsClassification: { in: ["ACADEMIC_ELECTIVE", "TECHPRO_ELECTIVE"] },
        },
      }),
      2,
    );
  });
});

test("explicit Term 2 progression replaces incomplete active legacy Core without fabricating Term 1", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createProgressionFixture(transaction, { entryPosition: 1, policyPosition: 2 });
    const term1 = fixture.academicYear.terms[0]!;
    const term2 = fixture.academicYear.terms[1]!;
    const coreOffering = await transaction.subjectOffering.findUniqueOrThrow({
      where: { id: fixture.cores[0]!.id },
      select: { id: true, subjectCode: true, subjectDescription: true, gradeLevel: true, shsContext: { include: { cluster: true } } },
    });
    const legacy = await transaction.studentSubjectEnrollment.create({ data: {
      enrollmentId: fixture.enrollment.id,
      subjectOfferingId: coreOffering.id,
      subjectCode: coreOffering.subjectCode,
      subjectDescription: coreOffering.subjectDescription,
      gradeLevel: coreOffering.gradeLevel,
      shsClassification: coreOffering.shsContext!.classification,
      shsClusterCode: coreOffering.shsContext!.cluster?.code,
      shsClusterName: coreOffering.shsContext!.cluster?.name,
      shsCurriculumStatus: coreOffering.shsContext!.curriculumStatus,
      shsSourceReference: coreOffering.shsContext!.sourceReference,
      shsApprovalReference: coreOffering.shsContext!.approvalReference,
      createdById: fixture.actor.id,
      terms: { create: { academicTermId: term1.id } },
    } });
    const result = await progressShsCurrentTermInTransaction(
      { enrollmentId: fixture.enrollment.id, subjectOfferingIds: [fixture.academicByPosition.get(2)!.id] },
      fixture.actor.id,
      transaction,
      clockFor(term2),
    );
    const rows = await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: fixture.enrollment.id, subjectOfferingId: coreOffering.id },
      select: { id: true, status: true, terms: { select: { academicTermId: true }, orderBy: { academicTerm: { position: "asc" } } } },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(result.replacedCore, 1);
    assert.deepEqual(rows, [
      { id: legacy.id, status: "REPLACED", terms: [{ academicTermId: term1.id }] },
      { id: rows[1]!.id, status: "ACTIVE", terms: fixture.academicYear.terms.slice(1).map(({ id }) => ({ academicTermId: id })) },
    ]);
  });
});

test("one Academic plus one TechPro elective satisfies a combined two-elective policy", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createProgressionFixture(transaction, {
      minimumElectives: 2,
      maximumElectives: 2,
    });
    const result = await progressShsCurrentTermInTransaction(
      {
        enrollmentId: fixture.enrollment.id,
        subjectOfferingIds: [fixture.academicByPosition.get(1)!.id, fixture.techPro.id],
      },
      fixture.actor.id,
      transaction,
      clockFor(fixture.entryTerm),
    );
    assert.equal(result.currentElectiveCount, 2);
    assert.equal(result.createdElectives, 2);
  });
});

test("progression rejects a missing current-Term policy without materializing subjects", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createProgressionFixture(transaction, { createPolicy: false });
    await assert.rejects(
      progressShsCurrentTermInTransaction(
        {
          enrollmentId: fixture.enrollment.id,
          subjectOfferingIds: [fixture.academicByPosition.get(1)!.id],
        },
        fixture.actor.id,
        transaction,
        clockFor(fixture.entryTerm),
      ),
      /policy is required/,
    );
    assert.equal(
      await transaction.studentSubjectEnrollment.count({
        where: { enrollmentId: fixture.enrollment.id },
      }),
      0,
    );
  });
});

test("Offering state is revalidated inside the locked progression transaction", async () => {
  await withRollback(async (transaction) => {
    const fixture = await createProgressionFixture(transaction);
    const elective = fixture.academicByPosition.get(1)!;
    await transaction.subjectOffering.update({ where: { id: elective.id }, data: { deletedAt: new Date() } });
    await assert.rejects(
      progressShsCurrentTermInTransaction(
        { enrollmentId: fixture.enrollment.id, subjectOfferingIds: [elective.id] },
        fixture.actor.id,
        transaction,
        clockFor(fixture.entryTerm),
      ),
      /must remain active/,
    );
  });
});

test("a forced audit failure rolls progressive participation back atomically", async () => {
  const before = await Promise.all([
    prisma.studentSubjectEnrollment.count(),
    prisma.studentSubjectEnrollmentTerm.count(),
    prisma.auditLog.count(),
  ]);
  await assert.rejects(prisma.$transaction(async (transaction) => {
    const fixture = await createProgressionFixture(transaction);
    await transaction.$executeRawUnsafe(`
      CREATE FUNCTION "phase21d_b2_reject_audit"() RETURNS trigger AS $$
      BEGIN
        IF NEW."module" = 'StudentSubjectEnrollment' THEN
          RAISE EXCEPTION 'forced B2 audit failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await transaction.$executeRawUnsafe(`
      CREATE TRIGGER "phase21d_b2_reject_audit_trigger"
      BEFORE INSERT ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION "phase21d_b2_reject_audit"()
    `);
    await progressShsCurrentTermInTransaction(
      { enrollmentId: fixture.enrollment.id, subjectOfferingIds: [fixture.academicByPosition.get(1)!.id] },
      fixture.actor.id,
      transaction,
      clockFor(fixture.entryTerm),
    );
  }), /forced B2 audit failure/);
  assert.deepEqual(await Promise.all([
    prisma.studentSubjectEnrollment.count(),
    prisma.studentSubjectEnrollmentTerm.count(),
    prisma.auditLog.count(),
  ]), before);
});

test("progressive SHS selection rejects JHS Enrollments", async () => {
  await withRollback(async (transaction) => {
    const [actor, academicYear] = await Promise.all([
      transaction.user.findFirstOrThrow({ where: { deletedAt: null, status: "ACTIVE" } }),
      transaction.academicYear.findFirstOrThrow({
        where: { status: "ACTIVE" },
        include: { terms: { orderBy: { position: "asc" } } },
      }),
    ]);
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const section = await transaction.section.create({
      data: { gradeLevel: "7", sectionName: `B2 JHS ${suffix}`, createdById: actor.id },
    });
    const student = await transaction.student.create({
      data: {
        lrn: `B2J${suffix}`,
        firstName: "Junior",
        lastName: "Student",
        gender: "MALE",
        barangay: "Test",
        municipality: "Test",
        province: "Test",
        createdById: actor.id,
      },
    });
    const enrollment = await transaction.enrollment.create({
      data: {
        studentId: student.id,
        sectionId: section.id,
        academicYearId: academicYear.id,
        createdById: actor.id,
      },
    });
    await assert.rejects(
      progressShsCurrentTermInTransaction(
        { enrollmentId: enrollment.id, subjectOfferingIds: [] },
        actor.id,
        transaction,
        clockFor(academicYear.terms[0]!),
      ),
      /limited to Grade 11 and 12/,
    );
  });
});

test("serializable orchestration and deterministic row-lock contracts remain explicit", () => {
  const service = readFileSync(
    path.join(process.cwd(), "services/student-subject-enrollment.service.ts"),
    "utf8",
  );
  const selection = readFileSync(
    path.join(process.cwd(), "services/student-subject-enrollment-selection.service.ts"),
    "utf8",
  );
  const repository = readFileSync(
    path.join(process.cwd(), "repositories/student-subject-enrollment.repository.ts"),
    "utf8",
  );
  const policyRepository = readFileSync(
    path.join(process.cwd(), "repositories/shs-elective-enrollment-policy.repository.ts"),
    "utf8",
  );

  assert.match(service, /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(service, /P2034|40001/);
  assert.match(selection, /lockActiveShsEnrollmentForCurriculumSelection/);
  assert.match(selection, /lockShsElectiveEnrollmentPolicyScope/);
  assert.match(selection, /lockActiveShsStudentSubjectEnrollments/);
  assert.match(repository, /orderedIds = \[\.\.\.new Set\(ids\)\]\.sort\(\)/);
  assert.match(repository, /ORDER BY "id"\s+FOR UPDATE/);
  assert.match(policyRepository, /FROM "ShsElectiveEnrollmentPolicy"[\s\S]*FOR UPDATE/);
});
