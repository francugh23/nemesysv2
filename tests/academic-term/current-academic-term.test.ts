import assert from "node:assert/strict";
import test from "node:test";

import {
  CurrentAcademicTermConfigurationError,
  getPhilippineCalendarDate,
  resolveCurrentAcademicTerm,
} from "../../lib/academic-term-current";

const terms = [
  { id: "term-2", startDate: new Date("2026-09-16T00:00:00.000Z"), endDate: new Date("2026-12-18T00:00:00.000Z") },
  { id: "term-1", startDate: new Date("2026-06-08T00:00:00.000Z"), endDate: new Date("2026-09-15T00:00:00.000Z") },
  { id: "term-3", startDate: new Date("2027-01-04T00:00:00.000Z"), endDate: new Date("2027-04-08T00:00:00.000Z") },
];
const activeYear = { id: "year", status: "ACTIVE", terms };

test("current Term uses inclusive configured dates rather than Term position", () => {
  assert.equal(resolveCurrentAcademicTerm([activeYear], () => new Date("2026-06-07T16:00:00.000Z"))?.academicTerm.id, "term-1");
  assert.equal(resolveCurrentAcademicTerm([activeYear], () => new Date("2026-09-15T15:59:59.000Z"))?.academicTerm.id, "term-1");
  assert.equal(resolveCurrentAcademicTerm([activeYear], () => new Date("2026-09-15T16:00:00.000Z"))?.academicTerm.id, "term-2");
  assert.equal(resolveCurrentAcademicTerm([activeYear], () => new Date("2026-12-18T15:59:59.000Z"))?.academicTerm.id, "term-2");
});

test("current Term returns null before, after, and between configured Terms", () => {
  assert.equal(resolveCurrentAcademicTerm([activeYear], () => new Date("2026-06-06T16:00:00.000Z")), null);
  assert.equal(resolveCurrentAcademicTerm([activeYear], () => new Date("2026-12-20T16:00:00.000Z")), null);
  assert.equal(resolveCurrentAcademicTerm([activeYear], () => new Date("2027-04-08T16:00:00.000Z")), null);
  assert.equal(resolveCurrentAcademicTerm([], () => new Date("2026-06-08T00:00:00.000Z")), null);
});

test("current Term rejects ambiguous active-year and Term configuration", () => {
  assert.throws(
    () => resolveCurrentAcademicTerm([activeYear, { ...activeYear, id: "year-2" }]),
    CurrentAcademicTermConfigurationError,
  );
  assert.throws(
    () => resolveCurrentAcademicTerm([{ ...activeYear, terms: [terms[0]!, { ...terms[0]!, id: "overlap" }] }], () => new Date("2026-10-01T00:00:00.000Z")),
    CurrentAcademicTermConfigurationError,
  );
});

test("Philippine calendar date honors Asia/Manila midnight", () => {
  assert.equal(getPhilippineCalendarDate(new Date("2026-06-07T15:59:59.000Z")), "2026-06-07");
  assert.equal(getPhilippineCalendarDate(new Date("2026-06-07T16:00:00.000Z")), "2026-06-08");
});
