import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import {
  findOfferingOptions,
  findShsCurriculumReferences,
  countShsCurriculumReferences,
} from "../../repositories/subject-offering.repository";
import {
  ShsCurriculumReferenceTableQuerySchema,
} from "../../schemas/subject-offering.schema";

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

test("Provisional DepEd catalog returns deterministic server pages and final-page metadata", async () => {
  const totalCount = await countShsCurriculumReferences();
  const pageSize = 50;
  const pageCount = Math.ceil(totalCount / pageSize);
  const finalPage = await findShsCurriculumReferences({
    skip: (pageCount - 1) * pageSize,
    take: pageSize,
  });

  assert.ok(totalCount > pageSize);
  assert.equal(finalPage.length, totalCount - (pageCount - 1) * pageSize);
  assert.ok(finalPage.length > 0 && finalPage.length <= pageSize);
  assert.deepEqual(
    ShsCurriculumReferenceTableQuerySchema.parse({ page: pageCount, pageSize }),
    { page: pageCount, pageSize },
  );
  assert.equal(
    ShsCurriculumReferenceTableQuerySchema.safeParse({ page: 0, pageSize }).success,
    false,
  );
});
