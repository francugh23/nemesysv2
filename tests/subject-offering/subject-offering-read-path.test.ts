import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";
import { findAcademicTermsByAcademicYear } from "../../repositories/academic-term.repository";
import { findOfferings } from "../../repositories/subject-offering.repository";

test("Offering foundation preserves the approved Grade 7 JHS full-year term source", async () => {
  const [terms, offerings] = await Promise.all([
    findAcademicTermsByAcademicYear("academic-year-2026-2027"),
    findOfferings({ academicYearId: "academic-year-2026-2027", gradeLevel: "7" }, { skip: 0, take: 50 }),
  ]);
  assert.equal(terms.length, 3);
  assert.equal(offerings.length, 8);
  assert.ok(offerings.every((offering) => offering.terms.length === 3));
});
