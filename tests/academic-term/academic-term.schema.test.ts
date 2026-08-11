import assert from "node:assert/strict";
import test from "node:test";

import { CreateAcademicTermSchema } from "../../schemas/academic-term.schema";
import { hasThreeChronologicallyOrderedTerms } from "../../lib/academic-term";

test("academic terms require valid chronological date-only boundaries", () => {
  assert.equal(
    CreateAcademicTermSchema.safeParse({
      name: "Term 1",
      position: 1,
      startDate: "2026-06-08",
      endDate: "2026-09-15",
    }).success,
    true,
  );
  assert.equal(
    CreateAcademicTermSchema.safeParse({
      name: "Term 1",
      position: 0,
      startDate: "2026-06-08",
      endDate: "2026-09-15",
    }).success,
    false,
  );
  assert.equal(
    CreateAcademicTermSchema.safeParse({
      name: "Term 1",
      position: 1,
      startDate: "2026-09-15",
      endDate: "2026-09-15",
    }).success,
    false,
  );
});

test("Academic Year activation policy requires exactly three chronologically ordered Terms", () => {
  assert.equal(
    hasThreeChronologicallyOrderedTerms([
      { startDate: new Date("2026-06-08T00:00:00.000Z"), endDate: new Date("2026-09-15T00:00:00.000Z") },
      { startDate: new Date("2026-09-16T00:00:00.000Z"), endDate: new Date("2026-12-18T00:00:00.000Z") },
      { startDate: new Date("2027-01-04T00:00:00.000Z"), endDate: new Date("2027-04-08T00:00:00.000Z") },
    ]),
    true,
  );
  assert.equal(
    hasThreeChronologicallyOrderedTerms([
      { startDate: new Date("2026-06-08T00:00:00.000Z"), endDate: new Date("2026-09-15T00:00:00.000Z") },
      { startDate: new Date("2026-09-15T00:00:00.000Z"), endDate: new Date("2026-12-18T00:00:00.000Z") },
      { startDate: new Date("2027-01-04T00:00:00.000Z"), endDate: new Date("2027-04-08T00:00:00.000Z") },
    ]),
    false,
  );
});
