import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";

const jhsPrefixes = ["FIL", "ENG", "MATH", "SCI", "AP", "MAPEH", "TLE", "GMRC"];

test("Phase 22D-A retains the exact 32 full-year JHS offering matrix", async () => {
  const year = await prisma.academicYear.findFirstOrThrow({ where: { label: "2026-2027", status: "ACTIVE" }, select: { id: true } });
  const offerings = await prisma.subjectOffering.findMany({ where: { academicYearId: year.id, gradeLevel: { in: ["7", "8", "9", "10"] }, deletedAt: null }, select: { subjectCode: true, gradeLevel: true, terms: { select: { academicTerm: { select: { position: true } } }, orderBy: { academicTerm: { position: "asc" } } } } });
  assert.equal(offerings.length, 32);
  for (const gradeLevel of ["7", "8", "9", "10"]) for (const prefix of jhsPrefixes) {
    const offering = offerings.find((item) => item.subjectCode === `${prefix}${gradeLevel}`);
    assert.equal(offering?.gradeLevel, gradeLevel);
    assert.deepEqual(offering?.terms.map(({ academicTerm }) => academicTerm.position), [1, 2, 3]);
  }
});

test("Phase 22D-A has five provisional full-year Grade 11 Core Offerings", async () => {
  const year = await prisma.academicYear.findFirstOrThrow({ where: { label: "2026-2027", status: "ACTIVE" }, select: { id: true } });
  const offerings = await prisma.subjectOffering.findMany({ where: { academicYearId: year.id, gradeLevel: "11", deletedAt: null, shsContext: { classification: "CORE" } }, select: { terms: { select: { academicTerm: { select: { position: true } } }, orderBy: { academicTerm: { position: "asc" } } }, shsContext: { select: { curriculumStatus: true, clusterId: true, approvalReference: true, approvedById: true, approvedAt: true } } } });
  assert.equal(offerings.length, 5);
  for (const offering of offerings) {
    assert.deepEqual(offering.terms.map(({ academicTerm }) => academicTerm.position), [1, 2, 3]);
    assert.equal(offering.shsContext?.curriculumStatus, "PROVISIONAL_DEPED");
    assert.equal(offering.shsContext?.clusterId, null);
    assert.equal(offering.shsContext?.approvalReference, null);
    assert.equal(offering.shsContext?.approvedById, null);
    assert.equal(offering.shsContext?.approvedAt, null);
  }
});
