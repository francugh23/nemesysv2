import assert from "node:assert/strict";
import test from "node:test";

import { isAcademicYearWritable } from "../../lib/academic-year";

test("only ACTIVE Academic Years permit dependent academic mutations", () => {
  assert.equal(isAcademicYearWritable("ACTIVE"), true);
  assert.equal(isAcademicYearWritable("DRAFT"), false);
  assert.equal(isAcademicYearWritable("LOCKED"), false);
  assert.equal(isAcademicYearWritable("ARCHIVED"), false);
});
