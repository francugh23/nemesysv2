import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";

test("Phase 21A preserves Subject, Offering, Term, and downstream record identities", async () => {
  const before = await Promise.all([
    prisma.subject.count(),
    prisma.subjectOffering.count(),
    prisma.enrollment.count(),
    prisma.studentSubjectEnrollment.count(),
  ]);
  const offerings = await prisma.subjectOffering.findMany({
    select: {
      id: true,
      subjectId: true,
      academicYearId: true,
      gradeLevel: true,
      deletedAt: true,
      terms: {
        select: {
          academicTerm: { select: { academicYearId: true } },
        },
      },
      shsContext: {
        select: {
          curriculumStatus: true,
          sourceReference: true,
          approvalReference: true,
          approvedById: true,
          approvedAt: true,
        },
      },
    },
  });

  assert.ok(offerings.length > 0);
  assert.ok(
    offerings.every((offering) =>
      offering.terms.every(
        ({ academicTerm }) =>
          academicTerm.academicYearId === offering.academicYearId,
      ),
    ),
  );
  assert.ok(
    offerings
      .filter(
        (offering) =>
          offering.deletedAt === null &&
          ["7", "8", "9", "10"].includes(offering.gradeLevel),
      )
      .every((offering) => offering.terms.length === 3),
  );
  assert.ok(
    offerings.every((offering) => {
      const context = offering.shsContext;

      if (!context) return true;
      if (!context.sourceReference?.trim()) return false;

      return context.curriculumStatus === "PROVISIONAL_DEPED"
        ? context.approvalReference === null &&
            context.approvedById === null &&
            context.approvedAt === null
        : Boolean(
            context.approvalReference?.trim() &&
              context.approvedById &&
              context.approvedAt,
          );
    }),
  );

  const activeIdentities = offerings
    .filter(({ deletedAt }) => deletedAt === null)
    .map(
      ({ subjectId, academicYearId, gradeLevel }) =>
        `${subjectId}|${academicYearId}|${gradeLevel}`,
    );
  assert.equal(new Set(activeIdentities).size, activeIdentities.length);
  assert.deepEqual(
    await Promise.all([
      prisma.subject.count(),
      prisma.subjectOffering.count(),
      prisma.enrollment.count(),
      prisma.studentSubjectEnrollment.count(),
    ]),
    before,
  );
});
