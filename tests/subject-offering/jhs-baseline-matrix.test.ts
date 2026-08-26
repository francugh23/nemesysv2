import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";

const categories = [
  ["FIL", "Filipino"],
  ["ENG", "English"],
  ["MATH", "Mathematics"],
  ["SCI", "Science"],
  ["AP", "Araling Panlipunan"],
  ["MAPEH", "MAPEH"],
  ["TLE", "TLE"],
  ["GMRC", "GMRC / Values Education"],
] as const;

test("2026-2027 JHS baseline has one full-year Offering per approved grade and category", async () => {
  const academicYear = await prisma.academicYear.findFirstOrThrow({
    where: { label: "2026-2027" },
    select: { id: true },
  });

  const [subjects, offerings, auditCount] = await Promise.all([
    prisma.subject.findMany({
      where: { deletedAt: null, gradeLevel: { in: ["7", "8", "9", "10"] } },
      select: { code: true, description: true, gradeLevel: true },
    }),
    prisma.subjectOffering.findMany({
      where: {
          academicYearId: academicYear.id,
        gradeLevel: { in: ["7", "8", "9", "10"] },
        deletedAt: null,
      },
      select: { subjectCode: true, subjectDescription: true, gradeLevel: true, terms: true },
    }),
    prisma.auditLog.count({
      where: {
        description: {
          equals: "Created subject offering.",
        },
      },
    }),
  ]);

  const expected = ["7", "8", "9", "10"].flatMap((grade) =>
    categories.map(([prefix, description]) => ({
      code: `${prefix}${grade}`,
      description,
      grade,
    })),
  );

  assert.equal(subjects.length, 32);
  assert.equal(offerings.length, 32);
  assert.equal(auditCount, 32);

  for (const item of expected) {
    assert.deepEqual(
      subjects.find((subject) => subject.code === item.code),
      { code: item.code, description: item.description, gradeLevel: item.grade },
    );
    const offering = offerings.find((value) => value.subjectCode === item.code);
    assert.equal(offering?.subjectDescription, item.description);
    assert.equal(offering?.gradeLevel, item.grade);
    assert.equal(offering?.terms.length, 3);
  }
});
