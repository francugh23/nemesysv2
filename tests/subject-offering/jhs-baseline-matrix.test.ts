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
  const [subjects, offerings, assignments, enrollments, grades, auditCount] = await Promise.all([
    prisma.subject.findMany({
      where: { deletedAt: null, gradeLevel: { in: ["7", "8", "9", "10"] } },
      select: { code: true, description: true, gradeLevel: true, trackStrand: true },
    }),
    prisma.subjectOffering.findMany({
      where: { academicYearId: "academic-year-2026-2027", deletedAt: null },
      select: { subjectCode: true, subjectDescription: true, gradeLevel: true, terms: true },
    }),
    prisma.subjectAssignment.count({ where: { deletedAt: null } }),
    prisma.enrollment.count({ where: { deletedAt: null } }),
    prisma.grade.count({ where: { deletedAt: null } }),
    prisma.auditLog.count({
      where: {
        description: {
          in: [
            "Created approved JHS baseline subject.",
            "Created approved full-year JHS baseline offering.",
          ],
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
  assert.equal(assignments, 0);
  assert.equal(enrollments, 0);
  assert.equal(grades, 0);
  assert.equal(auditCount, 64);

  for (const item of expected) {
    assert.deepEqual(
      subjects.find((subject) => subject.code === item.code),
      { code: item.code, description: item.description, gradeLevel: item.grade, trackStrand: null },
    );
    const offering = offerings.find((value) => value.subjectCode === item.code);
    assert.equal(offering?.subjectDescription, item.description);
    assert.equal(offering?.gradeLevel, item.grade);
    assert.equal(offering?.terms.length, 3);
  }
});
