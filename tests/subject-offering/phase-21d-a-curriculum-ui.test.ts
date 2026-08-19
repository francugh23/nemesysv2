import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import {
  findOfferingOptions,
} from "../../repositories/subject-offering.repository";

test("Curriculum options keep Terms owned by each selected active Academic Year", async () => {
  const [, academicYears] = await findOfferingOptions();

  assert.ok(academicYears.length > 0);
  assert.ok(academicYears.every((academicYear) => academicYear.terms.length > 0));
  assert.ok(
    academicYears.every((academicYear) =>
      academicYear.terms.every((term, index) =>
        term.position === index + 1,
      ),
    ),
  );
});
