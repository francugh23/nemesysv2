import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import prisma from "../../lib/prisma";
import { depedShsCatalogEntries } from "../../lib/shs-deped-catalog";
import { populateInTransaction, populateProvisionalDepedReferenceCatalog } from "../../services/deped-reference-catalog.service";
import { selectShsStudentCurriculumInTransaction } from "../../services/student-subject-enrollment-selection.service";

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

async function getCatalogFixture(tx: Prisma.TransactionClient, gradeLevel: "11" | "12") {
  const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null, status: "ACTIVE" }, select: { id: true } });
  const academicYear = await tx.academicYear.findUniqueOrThrow({
    where: { id: "academic-year-2026-2027" },
    select: { id: true, terms: { select: { id: true }, orderBy: { position: "asc" } } },
  });
  const reference = await tx.shsCurriculumReference.findFirstOrThrow({
    where: { gradeLevel, classification: "TECHPRO_ELECTIVE" },
    select: {
      subjectId: true,
      gradeLevel: true,
      classification: true,
      clusterId: true,
      sourceReference: true,
      subject: { select: { code: true, description: true } },
    },
    orderBy: { subject: { code: "asc" } },
  });
  return { actor, academicYear, reference };
}

async function createCatalogOffering(
  fixture: Awaited<ReturnType<typeof getCatalogFixture>>,
  curriculumStatus: "PROVISIONAL_DEPED" | "SCHOOL_APPROVED",
  tx: Prisma.TransactionClient,
  academicTermIds = fixture.academicYear.terms.map(({ id }) => id),
) {
  return tx.subjectOffering.create({
    data: {
      subjectId: fixture.reference.subjectId,
      academicYearId: fixture.academicYear.id,
      gradeLevel: fixture.reference.gradeLevel,
      subjectCode: fixture.reference.subject.code,
      subjectDescription: fixture.reference.subject.description,
      createdById: fixture.actor.id,
      terms: { create: academicTermIds.map((academicTermId) => ({ academicTermId })) },
      shsContext: {
        create: {
          classification: fixture.reference.classification,
          curriculumStatus,
          clusterId: fixture.reference.clusterId,
          sourceReference: fixture.reference.sourceReference,
          approvalReference: curriculumStatus === "SCHOOL_APPROVED" ? "Phase 21C school approval fixture" : null,
          approvedById: curriculumStatus === "SCHOOL_APPROVED" ? fixture.actor.id : null,
          approvedAt: curriculumStatus === "SCHOOL_APPROVED" ? new Date() : null,
          createdById: fixture.actor.id,
        },
      },
    },
    select: { id: true },
  });
}

async function createEnrollment(gradeLevel: "11" | "12", fixture: Awaited<ReturnType<typeof getCatalogFixture>>, tx: Prisma.TransactionClient) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const section = await tx.section.create({ data: { gradeLevel, sectionName: `P21C ${suffix}`, createdById: fixture.actor.id }, select: { id: true } });
  const student = await tx.student.create({
    data: {
      lrn: `P21C${suffix}`,
      firstName: "Phase",
      lastName: "TwentyOneC",
      gender: "FEMALE",
      barangay: "Test",
      municipality: "Test",
      province: "Test",
      createdById: fixture.actor.id,
    },
    select: { id: true },
  });
  return tx.enrollment.create({
    data: { studentId: student.id, sectionId: section.id, academicYearId: fixture.academicYear.id, createdById: fixture.actor.id },
    select: { id: true },
  });
}

test("Phase 21C catalog records exact Grade 11 applicability and leaves Grade 12 pilot Terms unresolved", () => {
  const grade11Core = depedShsCatalogEntries.filter(({ gradeLevel, classification }) => gradeLevel === "11" && classification === "CORE");
  const grade11TechPro = depedShsCatalogEntries.filter(({ gradeLevel, classification }) => gradeLevel === "11" && classification === "TECHPRO_ELECTIVE");
  const grade12TechPro = depedShsCatalogEntries.filter(({ gradeLevel, classification }) => gradeLevel === "12" && classification === "TECHPRO_ELECTIVE");
  const unresolvedAcademic = depedShsCatalogEntries.filter(({ classification }) => classification === "ACADEMIC_ELECTIVE");

  assert.equal(grade11Core.length, 6);
  assert.equal(grade11TechPro.length, 44);
  assert.ok([...grade11Core, ...grade11TechPro].every(({ termApplicability, createOffering }) => termApplicability === "ALL_CONFIGURED_TERMS" && createOffering));
  assert.equal(grade12TechPro.length, 44);
  assert.ok(grade12TechPro.every(({ termApplicability, createOffering, sourceReference }) => termApplicability === "ONE_CONFIGURED_TERM_UNRESOLVED" && !createOffering && sourceReference.includes("DM_s2026_036r-UPDATED.pdf")));
  assert.equal(unresolvedAcademic.length, 77);
  assert.ok(unresolvedAcademic.every(({ termApplicability, createOffering }) => termApplicability === "UNSPECIFIED" && !createOffering));
});

test("Phase 21C reconciliation and school approval serialize on the same Offering lock", () => {
  const root = process.cwd();
  const repositorySource = readFileSync(path.join(root, "repositories", "subject-offering.repository.ts"), "utf8");
  const catalogRepositorySource = readFileSync(path.join(root, "repositories", "deped-reference-catalog.repository.ts"), "utf8");
  const approvalSource = readFileSync(path.join(root, "services", "subject-offering.service.ts"), "utf8");
  const catalogSource = readFileSync(path.join(root, "services", "deped-reference-catalog.service.ts"), "utf8");

  assert.match(repositorySource, /lockOfferingForMutation[\s\S]*FOR UPDATE/);
  assert.match(catalogRepositorySource, /findAndLockCatalogOffering[\s\S]*FOR UPDATE/);
  assert.match(approvalSource, /lockOfferingForMutation\(values\.subjectOfferingId, tx\)[\s\S]*findOffering/);
  assert.match(catalogSource, /findAndLockCatalogOffering\(subject\.id, academicYear\.id, entry\.gradeLevel, tx\)/);
});

test("Phase 21C populated catalog has exact active Grade 11 Terms, unresolved Grade 12 references, and no duplication", async () => {
  const [terms, references, activeOfferings, jhsOfferings, catalogSubjects] = await Promise.all([
    prisma.academicTerm.findMany({ where: { academicYearId: "academic-year-2026-2027" }, select: { id: true } }),
    prisma.shsCurriculumReference.findMany({ select: { gradeLevel: true, classification: true, termApplicability: true } }),
    prisma.subjectOffering.findMany({
      where: { academicYearId: "academic-year-2026-2027", deletedAt: null, shsContext: { isNot: null } },
      select: { subjectId: true, gradeLevel: true, terms: { select: { academicTermId: true } }, shsContext: { select: { curriculumStatus: true } } },
    }),
    prisma.subjectOffering.findMany({
      where: { academicYearId: "academic-year-2026-2027", deletedAt: null, gradeLevel: { in: ["7", "8", "9", "10"] } },
      select: { terms: { select: { academicTermId: true } } },
    }),
    prisma.subject.findMany({ where: { code: { startsWith: "SSHS-G" }, deletedAt: null }, select: { code: true } }),
  ]);

  assert.equal(terms.length, 3);
  assert.equal(references.filter(({ gradeLevel, classification, termApplicability }) => gradeLevel === "12" && classification === "TECHPRO_ELECTIVE" && termApplicability === "ONE_CONFIGURED_TERM_UNRESOLVED").length, 44);
  assert.equal(activeOfferings.length, 50);
  assert.ok(activeOfferings.every(({ gradeLevel, terms: offeringTerms }) => gradeLevel === "11" && offeringTerms.length === 3));
  assert.ok(activeOfferings.some(({ shsContext }) => shsContext?.curriculumStatus === "PROVISIONAL_DEPED"));
  assert.equal(new Set(activeOfferings.map(({ subjectId, gradeLevel }) => `${subjectId}:${gradeLevel}`)).size, activeOfferings.length);
  assert.ok(jhsOfferings.every(({ terms: offeringTerms }) => offeringTerms.length === 3));
  assert.equal(catalogSubjects.length, 171);
  assert.equal(new Set(catalogSubjects.map(({ code }) => code)).size, catalogSubjects.length);
});

test("Phase 21C population archives unsupported unreferenced provisional Grade 12 Offerings", async () => {
  await withRollback(async (tx) => {
    const fixture = await getCatalogFixture(tx, "12");
    const offering = await createCatalogOffering(fixture, "PROVISIONAL_DEPED", tx);

    const result = await populateInTransaction(fixture.actor.id, fixture.academicYear.id, tx);
    assert.equal(result.archivedOfferings, 1);
    assert.equal(result.removedOfferingTerms, 3);
    assert.equal(result.unresolvedOperationalOfferings, 0);

    const corrected = await tx.subjectOffering.findUniqueOrThrow({ where: { id: offering.id }, select: { deletedAt: true, terms: true } });
    assert.ok(corrected.deletedAt);
    assert.equal(corrected.terms.length, 0);
    assert.equal(await tx.subjectOffering.count({ where: { subjectId: fixture.reference.subjectId, academicYearId: fixture.academicYear.id, gradeLevel: "12", deletedAt: null } }), 0);

    const schoolConfigured = await createCatalogOffering(fixture, "PROVISIONAL_DEPED", tx, [fixture.academicYear.terms[0].id]);
    const rerun = await populateInTransaction(fixture.actor.id, fixture.academicYear.id, tx);
    assert.equal(rerun.archivedOfferings, 0);
    assert.equal(rerun.unresolvedOperationalOfferings, 1);
    assert.deepEqual(await tx.subjectOffering.findUniqueOrThrow({ where: { id: schoolConfigured.id }, select: { deletedAt: true, terms: { select: { academicTermId: true } } } }), {
      deletedAt: null,
      terms: [{ academicTermId: fixture.academicYear.terms[0].id }],
    });
  });
});

test("Phase 21C population repairs only exact provisional Grade 11 catalog signatures", async () => {
  await withRollback(async (tx) => {
    const offering = await tx.subjectOffering.findFirstOrThrow({
      where: {
        academicYearId: "academic-year-2026-2027",
        gradeLevel: "11",
        deletedAt: null,
        shsContext: { is: { curriculumStatus: "PROVISIONAL_DEPED" } },
        studentSubjectEnrollments: { none: {} },
      },
      select: { id: true, createdById: true, terms: { select: { academicTermId: true }, orderBy: { academicTerm: { position: "asc" } } } },
      orderBy: { subjectCode: "asc" },
    });
    const actor = await tx.user.findUniqueOrThrow({ where: { id: offering.createdById }, select: { id: true } });
    await tx.subjectOfferingTerm.delete({ where: { subjectOfferingId_academicTermId: { subjectOfferingId: offering.id, academicTermId: offering.terms[2].academicTermId } } });

    const repaired = await populateInTransaction(actor.id, "academic-year-2026-2027", tx);
    assert.equal(repaired.reconfiguredOfferings, 1);
    assert.equal((await tx.subjectOffering.findUniqueOrThrow({ where: { id: offering.id }, select: { terms: true } })).terms.length, 3);

    await tx.subjectOfferingShsContext.update({ where: { subjectOfferingId: offering.id }, data: { sourceReference: "School-specific source" } });
    await tx.subjectOfferingTerm.delete({ where: { subjectOfferingId_academicTermId: { subjectOfferingId: offering.id, academicTermId: offering.terms[2].academicTermId } } });
    const preserved = await populateInTransaction(actor.id, "academic-year-2026-2027", tx);
    assert.equal(preserved.reconfiguredOfferings, 0);
    assert.equal(preserved.unresolvedOperationalOfferings, 1);
    assert.equal((await tx.subjectOffering.findUniqueOrThrow({ where: { id: offering.id }, select: { terms: true } })).terms.length, 2);
  });
});

test("Phase 21C population preserves school-approved Grade 12 Offerings and exact replacement snapshots", async () => {
  await withRollback(async (tx) => {
    const fixture = await getCatalogFixture(tx, "12");
    const offering = await createCatalogOffering(fixture, "SCHOOL_APPROVED", tx);
    const enrollment = await createEnrollment("12", fixture, tx);
    const firstTermId = fixture.academicYear.terms[0].id;
    const secondTermId = fixture.academicYear.terms[1].id;

    await selectShsStudentCurriculumInTransaction({ enrollmentId: enrollment.id, selections: [{ subjectOfferingId: offering.id, academicTermIds: [firstTermId] }] }, fixture.actor.id, tx);
    await selectShsStudentCurriculumInTransaction({ enrollmentId: enrollment.id, selections: [{ subjectOfferingId: offering.id, academicTermIds: [secondTermId] }] }, fixture.actor.id, tx);
    const before = await tx.studentSubjectEnrollment.findMany({
      where: { enrollmentId: enrollment.id },
      select: { id: true, status: true, subjectCode: true, subjectDescription: true, gradeLevel: true, terms: { select: { academicTermId: true } } },
      orderBy: { createdAt: "asc" },
    });

    const result = await populateInTransaction(fixture.actor.id, fixture.academicYear.id, tx);
    assert.equal(result.unresolvedOperationalOfferings, 1);
    assert.equal(result.archivedOfferings, 0);
    assert.deepEqual(await tx.studentSubjectEnrollment.findMany({
      where: { enrollmentId: enrollment.id },
      select: { id: true, status: true, subjectCode: true, subjectDescription: true, gradeLevel: true, terms: { select: { academicTermId: true } } },
      orderBy: { createdAt: "asc" },
    }), before);
    assert.deepEqual(before.map(({ status, terms: selectedTerms }) => ({ status, termIds: selectedTerms.map(({ academicTermId }) => academicTermId) })), [
      { status: "REPLACED", termIds: [firstTermId] },
      { status: "ACTIVE", termIds: [secondTermId] },
    ]);

    const preservedOffering = await tx.subjectOffering.findUniqueOrThrow({ where: { id: offering.id }, select: { deletedAt: true, terms: true, shsContext: { select: { curriculumStatus: true } } } });
    assert.equal(preservedOffering.deletedAt, null);
    assert.equal(preservedOffering.terms.length, 3);
    assert.equal(preservedOffering.shsContext?.curriculumStatus, "SCHOOL_APPROVED");
  });
});

test("Phase 21C population is idempotent and provisional Offering materialization remains blocked", async () => {
  const actor = await prisma.user.findFirstOrThrow({ where: { deletedAt: null, status: "ACTIVE" }, select: { id: true } });
  const beforeStatuses = await prisma.subjectOfferingShsContext.findMany({
    select: { subjectOfferingId: true, curriculumStatus: true, approvalReference: true, approvedById: true, approvedAt: true },
    orderBy: { subjectOfferingId: "asc" },
  });
  assert.deepEqual(await populateProvisionalDepedReferenceCatalog(actor.id), {
    createdClusters: 0,
    createdSubjects: 0,
    createdReferences: 0,
    createdOfferings: 0,
    updatedReferences: 0,
    reconfiguredOfferings: 0,
    archivedOfferings: 0,
    removedOfferingTerms: 0,
    unresolvedOperationalOfferings: 0,
  });
  assert.deepEqual(await prisma.subjectOfferingShsContext.findMany({
    select: { subjectOfferingId: true, curriculumStatus: true, approvalReference: true, approvedById: true, approvedAt: true },
    orderBy: { subjectOfferingId: "asc" },
  }), beforeStatuses);

  await assert.rejects(prisma.$transaction(async (tx) => {
    const fixture = await getCatalogFixture(tx, "11");
    const offering = await tx.subjectOffering.findFirstOrThrow({
      where: { subjectId: fixture.reference.subjectId, academicYearId: fixture.academicYear.id, deletedAt: null },
      select: { id: true, subjectCode: true, subjectDescription: true, gradeLevel: true, shsContext: true },
    });
    const enrollment = await createEnrollment("11", fixture, tx);
    await tx.studentSubjectEnrollment.create({
      data: {
        enrollmentId: enrollment.id,
        subjectOfferingId: offering.id,
        subjectCode: offering.subjectCode,
        subjectDescription: offering.subjectDescription,
        gradeLevel: offering.gradeLevel,
        shsClassification: offering.shsContext!.classification,
        shsClusterCode: null,
        shsClusterName: null,
        shsCurriculumStatus: "PROVISIONAL_DEPED",
        shsSourceReference: offering.shsContext!.sourceReference,
        createdById: fixture.actor.id,
      },
    });
  }), /Provisional DepEd Subject Offerings cannot materialize/i);
});
