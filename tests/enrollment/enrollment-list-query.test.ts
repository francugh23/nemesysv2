import assert from "node:assert/strict";
import test from "node:test";

import { EnrollmentTableQuerySchema } from "../../schemas/enrollment.schema";

test("Enrollment list query validates and normalizes represented Track/Strand filtering", () => {
  assert.deepEqual(
    EnrollmentTableQuerySchema.parse({ trackStrand: "  STEM  " }),
    { trackStrand: "STEM", page: 1, pageSize: 10 },
  );
  assert.equal(
    EnrollmentTableQuerySchema.safeParse({ trackStrand: "   " }).success,
    false,
  );
});
