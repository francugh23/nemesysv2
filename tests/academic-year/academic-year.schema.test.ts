import assert from "node:assert/strict";
import test from "node:test";

import {
  AcademicYearTableQuerySchema,
  CreateAcademicYearSchema,
} from "../../schemas/academic-year.schema";

test("academic year dates require valid date-only values in consecutive years", () => {
  assert.equal(
    CreateAcademicYearSchema.safeParse({
      startDate: "2026-06-01",
      endDate: "2027-03-31",
    }).success,
    true,
  );
  assert.equal(
    CreateAcademicYearSchema.safeParse({
      startDate: "2026-02-30",
      endDate: "2027-03-31",
    }).success,
    false,
  );
  assert.equal(
    CreateAcademicYearSchema.safeParse({
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2027-03-31",
    }).success,
    false,
  );
  assert.equal(
    CreateAcademicYearSchema.safeParse({
      startDate: "2026-06-01",
      endDate: "2028-03-31",
    }).success,
    false,
  );
});

test("academic year dates must be chronological", () => {
  assert.equal(
    CreateAcademicYearSchema.safeParse({
      startDate: "2027-06-01",
      endDate: "2027-05-31",
    }).success,
    false,
  );
});

test("academic year table query normalizes pagination and validates represented statuses", () => {
  assert.deepEqual(
    AcademicYearTableQuerySchema.parse({
      q: "  2026  ",
      status: "LOCKED",
      page: "2",
      pageSize: "25",
    }),
    {
      q: "2026",
      status: "LOCKED",
      page: 2,
      pageSize: 25,
    },
  );
  assert.equal(
    AcademicYearTableQuerySchema.safeParse({ status: "REOPENED" }).success,
    false,
  );
});
