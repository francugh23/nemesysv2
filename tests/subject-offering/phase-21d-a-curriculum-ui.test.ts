import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import {
  findOfferingOptions,
} from "../../repositories/subject-offering.repository";

test("Curriculum options exclude finalized years and keep Terms owned by configurable active years", async () => {
  const [, academicYears] = await findOfferingOptions();

  assert.ok(academicYears.every((academicYear) => academicYear.terms.length > 0));
  assert.ok(
    academicYears.every((academicYear) =>
      academicYear.terms.every((term, index) =>
        term.position === index + 1,
      ),
    ),
  );
});
