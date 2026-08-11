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

test("Phase 21C catalog records exact per-subject Academic applicability and leaves unsupported references unresolved", () => {
  const grade11Core = depedShsCatalogEntries.filter(({ gradeLevel, classification }) => gradeLevel === "11" && classification === "CORE");
  const grade11TechPro = depedShsCatalogEntries.filter(({ gradeLevel, classification }) => gradeLevel === "11" && classification === "TECHPRO_ELECTIVE");
  const grade12TechPro = depedShsCatalogEntries.filter(({ gradeLevel, classification }) => gradeLevel === "12" && classification === "TECHPRO_ELECTIVE");
  const academic = depedShsCatalogEntries.filter(({ classification }) => classification === "ACADEMIC_ELECTIVE");
  const exactAcademic = academic.filter(({ termApplicability }) => termApplicability === "EXACT_CONFIGURED_TERMS");
  const expectedPositions = new Map<string, number>([
    ["Contemporary Literature 1", 1], ["Biology 1", 1], ["Human Movement 1 - Basic Anatomy in Sports and Exercise", 1], ["Creative Industries - Literary Arts", 1], ["Introduction to Organization and Management", 1],
    ["Contemporary Literature 2", 2], ["Biology 2", 2], ["Human Movement 2 - Motor Skills Development", 2], ["Leadership and Management in the Arts", 2], ["Business 1 - Basic Accounting", 2],
    ["Chemistry 1", 3], ["Biology 3", 3], ["Sports Officiating", 3], ["Filipino Identity Through the Arts", 3], ["Business 2 - Business Finance and Income Taxation", 3],
  ]);

  assert.equal(grade11Core.length, 6);
  assert.equal(grade11TechPro.length, 44);
  assert.ok([...grade11Core, ...grade11TechPro].every(({ termApplicability, createOffering }) => termApplicability === "ALL_CONFIGURED_TERMS" && createOffering));
  assert.equal(grade12TechPro.length, 44);
  assert.ok(grade12TechPro.every(({ termApplicability, createOffering, sourceReference }) => termApplicability === "ONE_CONFIGURED_TERM_UNRESOLVED" && !createOffering && sourceReference.includes("DM_s2026_036r-UPDATED.pdf")));
  assert.equal(academic.length, 77);
  assert.equal(exactAcademic.length, 15);
  assert.equal(academic.filter(({ createOffering }) => createOffering).length, 12);
  assert.equal(academic.filter(({ termApplicability }) => termApplicability === "UNSPECIFIED").length, 62);
  assert.ok(exactAcademic.every(({ description, termPositions }) => termPositions.length === 1 && termPositions[0] === expectedPositions.get(description)));
  assert.ok(exactAcademic.filter(({ description }) => description.startsWith("Human Movement") || description === "Sports Officiating").every(({ createOffering, schoolCategories }) => !createOffering && schoolCategories.length === 0));
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

test("Phase 21C populated catalog has 12 one-Term Academic Offerings, four Academic categories, and separate ICT tracks", async () => {
  const [terms, references, activeOfferings, jhsOfferings, catalogSubjects] = await Promise.all([
    prisma.academicTerm.findMany({ where: { academicYearId: "academic-year-2026-2027" }, select: { id: true } }),
    prisma.shsCurriculumReference.findMany({ select: { gradeLevel: true, classification: true, termApplicability: true, termPositions: true, schoolCategories: true } }),
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
  assert.equal(activeOfferings.length, 62);
  assert.ok(activeOfferings.every(({ gradeLevel }) => gradeLevel === "11"));
  assert.equal(activeOfferings.filter(({ terms: offeringTerms }) => offeringTerms.length === 1).length, 12);
  assert.equal(activeOfferings.filter(({ terms: offeringTerms }) => offeringTerms.length === 3).length, 50);
  assert.ok(activeOfferings.some(({ shsContext }) => shsContext?.curriculumStatus === "PROVISIONAL_DEPED"));
  assert.equal(new Set(activeOfferings.map(({ subjectId, gradeLevel }) => `${subjectId}:${gradeLevel}`)).size, activeOfferings.length);
  assert.ok(jhsOfferings.every(({ terms: offeringTerms }) => offeringTerms.length === 3));
  assert.equal(catalogSubjects.length, 171);
  assert.equal(new Set(catalogSubjects.map(({ code }) => code)).size, catalogSubjects.length);
  const clusters = await prisma.shsCurriculumCluster.findMany({ where: { deletedAt: null }, select: { code: true, track: true, isSchoolFacing: true } });
  assert.deepEqual(clusters.filter(({ track, isSchoolFacing }) => track === "ACADEMIC" && isSchoolFacing).map(({ code }) => code).sort(), ["DEPED-ACA-ASSH", "DEPED-ACA-BE", "DEPED-ACA-ICT", "DEPED-ACA-STEM"]);
  assert.equal(clusters.find(({ code }) => code === "DEPED-ACA-ICT")?.track, "ACADEMIC");
  assert.equal(clusters.find(({ code }) => code === "DEPED-TP-ICT")?.track, "TECHPRO");
});

test("Phase 21C reconciles the exact legacy Academic catalog state with transactional audits", async () => {
  await withRollback(async (tx) => {
    const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null, status: "ACTIVE" }, select: { id: true } });
    const academicOfferings = await tx.subjectOffering.findMany({
      where: { academicYearId: "academic-year-2026-2027", deletedAt: null, shsContext: { is: { classification: "ACADEMIC_ELECTIVE", curriculumStatus: "PROVISIONAL_DEPED" } } },
      select: { id: true },
    });
    assert.equal(academicOfferings.length, 12);
    const offeringIds = academicOfferings.map(({ id }) => id);
    await tx.subjectOfferingTerm.deleteMany({ where: { subjectOfferingId: { in: offeringIds } } });
    await tx.subjectOfferingShsContext.deleteMany({ where: { subjectOfferingId: { in: offeringIds } } });
    await tx.subjectOffering.deleteMany({ where: { id: { in: offeringIds } } });
    await tx.shsCurriculumReference.updateMany({
      where: { classification: "ACADEMIC_ELECTIVE" },
      data: { termApplicability: "UNSPECIFIED", termPositions: [], schoolCategories: [] },
    });
    await tx.shsCurriculumCluster.updateMany({ where: { code: { in: ["DEPED-ACA-SHW", "DEPED-ACA-FE"] } }, data: { isSchoolFacing: true } });
    await tx.shsCurriculumCluster.delete({ where: { id: (await tx.shsCurriculumCluster.findFirstOrThrow({ where: { code: "DEPED-ACA-ICT", deletedAt: null }, select: { id: true } })).id } });
    const auditCount = await tx.auditLog.count();

    const result = await populateInTransaction(actor.id, "academic-year-2026-2027", tx);
    assert.deepEqual(result, {
      createdClusters: 1,
      updatedClusters: 2,
      demotedCustomAcademicClusters: 0,
      preservedOperationalClusters: 0,
      createdSubjects: 0,
      createdReferences: 0,
      createdOfferings: 12,
      updatedReferences: 66,
      correctedTermReferences: 15,
      mappedCategoryReferences: 63,
      reconfiguredOfferings: 0,
      archivedOfferings: 0,
      removedOfferingTerms: 0,
      unresolvedOperationalOfferings: 0,
      skippedOperationalOfferings: 0,
      conflicts: 0,
      unresolvedReferences: 65,
    });
    assert.equal(await tx.auditLog.count(), auditCount + 81);
    assert.equal(await tx.subjectOffering.count({ where: { academicYearId: "academic-year-2026-2027", deletedAt: null, shsContext: { is: { classification: "ACADEMIC_ELECTIVE" } } } }), 12);
  });
});

test("Phase 21C keeps custom Academic clusters and operational Offerings as source-only history", async () => {
  await withRollback(async (tx) => {
    const actor = await tx.user.findFirstOrThrow({ where: { deletedAt: null, status: "ACTIVE" }, select: { id: true } });
    const term = await tx.academicTerm.findFirstOrThrow({ where: { academicYearId: "academic-year-2026-2027", position: 1 }, select: { id: true } });
    const cluster = await tx.shsCurriculumCluster.create({
      data: { code: `P21C-CUSTOM-${randomUUID().slice(0, 8)}`, name: "Historical Academic Category", track: "ACADEMIC", createdById: actor.id },
      select: { id: true },
    });
    const subject = await tx.subject.create({ data: { code: `P21C-SUB-${randomUUID().slice(0, 8)}`, description: "Historical Academic Subject", gradeLevel: "11", createdById: actor.id }, select: { id: true, code: true, description: true } });
    const offering = await tx.subjectOffering.create({
      data: {
        subjectId: subject.id,
        academicYearId: "academic-year-2026-2027",
        gradeLevel: "11",
        subjectCode: subject.code,
        subjectDescription: subject.description,
        createdById: actor.id,
        terms: { create: { academicTermId: term.id } },
        shsContext: { create: { classification: "ACADEMIC_ELECTIVE", curriculumStatus: "SCHOOL_APPROVED", clusterId: cluster.id, sourceReference: "Historical school configuration", approvalReference: "Historical approval", approvedById: actor.id, approvedAt: new Date(), createdById: actor.id } },
      },
      select: { id: true },
    });

    const result = await populateInTransaction(actor.id, "academic-year-2026-2027", tx);
    assert.equal(result.demotedCustomAcademicClusters, 1);
    assert.equal(result.preservedOperationalClusters, 1);
    assert.equal((await tx.shsCurriculumCluster.findUniqueOrThrow({ where: { id: cluster.id }, select: { isSchoolFacing: true } })).isSchoolFacing, false);
    assert.deepEqual(await tx.subjectOffering.findUniqueOrThrow({ where: { id: offering.id }, select: { deletedAt: true, terms: { select: { academicTermId: true } }, shsContext: { select: { curriculumStatus: true, clusterId: true } } } }), {
      deletedAt: null,
      terms: [{ academicTermId: term.id }],
      shsContext: { curriculumStatus: "SCHOOL_APPROVED", clusterId: cluster.id },
    });
    assert.equal(await tx.auditLog.count({ where: { module: "ShsCurriculumCluster", recordId: cluster.id, action: "UPDATE" } }), 1);
  });
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
        shsContext: { is: { curriculumStatus: "PROVISIONAL_DEPED", classification: "CORE" } },
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

test("Phase 21C corrects only an exact provisional Academic catalog signature and audits the Term change", async () => {
  await withRollback(async (tx) => {
    const offering = await tx.subjectOffering.findFirstOrThrow({
      where: {
        academicYearId: "academic-year-2026-2027",
        gradeLevel: "11",
        deletedAt: null,
        shsContext: { is: { classification: "ACADEMIC_ELECTIVE", curriculumStatus: "PROVISIONAL_DEPED" } },
      },
      select: {
        id: true,
        createdById: true,
        terms: { select: { academicTermId: true } },
        academicYear: { select: { terms: { select: { id: true }, orderBy: { position: "asc" } } } },
      },
      orderBy: { subjectCode: "asc" },
    });
    const expectedTermId = offering.terms[0].academicTermId;
    await tx.subjectOfferingTerm.createMany({
      data: offering.academicYear.terms.filter(({ id }) => id !== expectedTermId).map(({ id }) => ({ subjectOfferingId: offering.id, academicTermId: id })),
    });

    const result = await populateInTransaction(offering.createdById, "academic-year-2026-2027", tx);
    assert.equal(result.reconfiguredOfferings, 1);
    assert.deepEqual(await tx.subjectOfferingTerm.findMany({ where: { subjectOfferingId: offering.id }, select: { academicTermId: true } }), [{ academicTermId: expectedTermId }]);
    assert.equal(await tx.auditLog.count({ where: { module: "SubjectOffering", recordId: offering.id, action: "UPDATE" } }), 1);

    const deliberateTermId = offering.academicYear.terms.find(({ id }) => id !== expectedTermId)!.id;
    await tx.subjectOffering.update({ where: { id: offering.id }, data: { terms: { deleteMany: {}, create: { academicTermId: deliberateTermId } } } });
    const preserved = await populateInTransaction(offering.createdById, "academic-year-2026-2027", tx);
    assert.equal(preserved.reconfiguredOfferings, 0);
    assert.equal(preserved.conflicts, 1);
    assert.deepEqual(await tx.subjectOfferingTerm.findMany({ where: { subjectOfferingId: offering.id }, select: { academicTermId: true } }), [{ academicTermId: deliberateTermId }]);
  });
});

test("Phase 21C approved one-Term Academic selection copies its configured Term and preserves replacement history", async () => {
  await withRollback(async (tx) => {
    const offering = await tx.subjectOffering.findFirstOrThrow({
      where: {
        academicYearId: "academic-year-2026-2027",
        gradeLevel: "11",
        deletedAt: null,
        shsContext: { is: { classification: "ACADEMIC_ELECTIVE", curriculumStatus: "PROVISIONAL_DEPED" } },
      },
      select: { id: true, createdById: true, terms: { select: { academicTermId: true } } },
      orderBy: { subjectCode: "asc" },
    });
    assert.equal(offering.terms.length, 1);
    await tx.subjectOfferingShsContext.update({
      where: { subjectOfferingId: offering.id },
      data: { curriculumStatus: "SCHOOL_APPROVED", approvalReference: "Phase 21C Academic approval", approvedById: offering.createdById, approvedAt: new Date() },
    });
    const fixture = await getCatalogFixture(tx, "11");
    const enrollment = await createEnrollment("11", fixture, tx);

    assert.deepEqual(await selectShsStudentCurriculumInTransaction({ enrollmentId: enrollment.id, selections: [{ subjectOfferingId: offering.id, academicTermIds: [offering.terms[0].academicTermId] }] }, offering.createdById, tx), { created: 1, replaced: 0 });
    const selected = await tx.studentSubjectEnrollment.findFirstOrThrow({ where: { enrollmentId: enrollment.id, status: "ACTIVE" }, select: { id: true, terms: { select: { academicTermId: true } } } });
    assert.deepEqual(selected.terms, [{ academicTermId: offering.terms[0].academicTermId }]);

    assert.deepEqual(await selectShsStudentCurriculumInTransaction({ enrollmentId: enrollment.id, selections: [] }, offering.createdById, tx), { created: 0, replaced: 1 });
    assert.deepEqual(await tx.studentSubjectEnrollment.findUniqueOrThrow({ where: { id: selected.id }, select: { status: true, terms: { select: { academicTermId: true } } } }), {
      status: "REPLACED",
      terms: [{ academicTermId: offering.terms[0].academicTermId }],
    });
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
    updatedClusters: 0,
    demotedCustomAcademicClusters: 0,
    preservedOperationalClusters: 0,
    createdSubjects: 0,
    createdReferences: 0,
    createdOfferings: 0,
    updatedReferences: 0,
    correctedTermReferences: 0,
    mappedCategoryReferences: 0,
    reconfiguredOfferings: 0,
    archivedOfferings: 0,
    removedOfferingTerms: 0,
    unresolvedOperationalOfferings: 0,
    skippedOperationalOfferings: 0,
    conflicts: 0,
    unresolvedReferences: 65,
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
