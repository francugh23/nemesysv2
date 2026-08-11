import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";
import { findAcademicTermsByAcademicYear } from "../../repositories/academic-term.repository";
import {
  findOfferingFilterOptions,
  findOfferings,
} from "../../repositories/subject-offering.repository";

test("Offering foundation preserves the approved Grade 7 JHS full-year term source", async () => {
  const [terms, offerings] = await Promise.all([
    findAcademicTermsByAcademicYear("academic-year-2026-2027"),
    findOfferings({ academicYearId: "academic-year-2026-2027", gradeLevel: "7" }, { skip: 0, take: 50 }),
  ]);
  assert.equal(terms.length, 3);
  assert.equal(offerings.length, 8);
  assert.ok(offerings.every((offering) => offering.terms.length === 3));
});

test("Offering list searches snapshots and exposes represented academic years", async () => {
  const offerings = await findOfferings(
    { academicYearId: "academic-year-2026-2027", gradeLevel: "7" },
    { skip: 0, take: 1 },
  );
  const offering = offerings[0];
  assert.ok(offering);

  const [byCode, byDescription, academicYears] = await Promise.all([
    findOfferings({ q: offering.subjectCode }, { skip: 0, take: 50 }),
    findOfferings({ q: offering.subjectDescription }, { skip: 0, take: 50 }),
    findOfferingFilterOptions(),
  ]);

  assert.ok(byCode.some((item) => item.id === offering.id));
  assert.ok(byDescription.some((item) => item.id === offering.id));
  assert.ok(
    academicYears.some((year) => year.id === "academic-year-2026-2027"),
  );
});
