import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import "dotenv/config";

import { Prisma } from "../../app/generated/prisma/client";
import { hasPermission, Permissions } from "../../lib/permissions";
import prisma from "../../lib/prisma";
import { CreateEnrollmentSchema } from "../../schemas/enrollment.schema";
import { deriveApprovedRegularJhsStudentSubjectEnrollments } from "../../services/jhs-student-subject-enrollment-derivation.service";
import {
  getEnrollmentFoundationValidationError,
  getEnrollmentPlacementCompatibilityError,
} from "../../services/enrollment-foundation.service";

class RollbackFixture extends Error {}

async function withRollback(
  run: (transaction: Prisma.TransactionClient) => Promise<void>,
) {
  try {
    await prisma.$transaction(async (transaction) => {
      await run(transaction);
      throw new RollbackFixture();
    });
  } catch (error) {
    if (!(error instanceof RollbackFixture)) throw error;
  }
}

async function createStudentAndSection(
  transaction: Prisma.TransactionClient,
  actorId: string,
  gradeLevel: string,
) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const [student, section] = await Promise.all([
    transaction.student.create({
      data: {
        lrn: `P21DA${suffix}`,
        firstName: "Foundation",
        lastName: "Student",
        gender: "FEMALE",
        barangay: "Test",
        municipality: "Test",
        province: "Test",
        createdById: actorId,
      },
      select: { id: true },
    }),
    transaction.section.create({
      data: {
        gradeLevel,
        sectionName: `Phase 21D-A ${suffix}`,
        createdById: actorId,
      },
      select: { id: true },
    }),
  ]);

  return { student, section };
}

async function getFoundationFixture(transaction: Prisma.TransactionClient) {
  const [actor, academicYear] = await Promise.all([
    transaction.user.findFirstOrThrow({
      where: { deletedAt: null, status: "ACTIVE" },
      select: { id: true },
    }),
    transaction.academicYear.findFirstOrThrow({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        label: true,
        terms: {
          select: { id: true },
          orderBy: { position: "asc" },
        },
      },
    }),
  ]);

  return { actor, academicYear, entryTerm: academicYear.terms[0]! };
}

for (const [gradeLevel, shsTrack] of [
  ["11", "ACADEMIC"],
  ["11", "TECHPRO"],
  ["12", "ACADEMIC"],
  ["12", "TECHPRO"],
] as const) {
  test(`creates Grade ${gradeLevel} ${shsTrack} with an explicit entry Term`, async () => {
    await withRollback(async (transaction) => {
      const fixture = await getFoundationFixture(transaction);
      const { student, section } = await createStudentAndSection(
        transaction,
        fixture.actor.id,
        gradeLevel,
      );
      const enrollment = await transaction.enrollment.create({
        data: {
          studentId: student.id,
          sectionId: section.id,
          academicYearId: fixture.academicYear.id,
          entryAcademicTermId: fixture.entryTerm.id,
          shsTrack,
          createdById: fixture.actor.id,
        },
      });

      assert.equal(enrollment.shsTrack, shsTrack);
      assert.equal(enrollment.entryAcademicTermId, fixture.entryTerm.id);
    });
  });
}

test("creates JHS without entry Term or Track and derives all three Terms", async () => {
  await withRollback(async (transaction) => {
    const fixture = await getFoundationFixture(transaction);
    const { student, section } = await createStudentAndSection(
      transaction,
      fixture.actor.id,
      "7",
    );
    const enrollment = await transaction.enrollment.create({
      data: {
        studentId: student.id,
        sectionId: section.id,
        academicYearId: fixture.academicYear.id,
        createdById: fixture.actor.id,
      },
    });
    await deriveApprovedRegularJhsStudentSubjectEnrollments(
      {
        enrollmentId: enrollment.id,
        academicYearId: fixture.academicYear.id,
        academicYearLabel: fixture.academicYear.label,
        gradeLevel: "7",
        trackStrand: null,
        studentLrn: `P21DA-${enrollment.id}`,
        actorId: fixture.actor.id,
      },
      transaction,
    );
    const subjects = await transaction.studentSubjectEnrollment.findMany({
      where: { enrollmentId: enrollment.id, status: "ACTIVE" },
      select: {
        terms: {
          select: { academicTermId: true },
          orderBy: { academicTerm: { position: "asc" } },
        },
      },
    });

    assert.equal(enrollment.shsTrack, null);
    assert.equal(enrollment.entryAcademicTermId, null);
    assert.equal(subjects.length, 8);
    assert.equal(subjects.every(({ terms }) => terms.length === 3), true);
    assert.deepEqual(
      subjects[0]!.terms.map(({ academicTermId }) => academicTermId),
      fixture.academicYear.terms.map(({ id }) => id),
    );
  });
});

test("schema permits omitted entry Term and limits Track values", () => {
  const base = {
    studentId: "student",
    sectionId: "section",
    academicYearId: "year",
  };
  assert.equal(CreateEnrollmentSchema.safeParse(base).success, true);
  assert.equal(
    CreateEnrollmentSchema.safeParse({
      ...base,
      entryAcademicTermId: "term",
      shsTrack: "STRAND",
    }).success,
    false,
  );
});

test("service rejects missing SHS Track and rejects Track for JHS", () => {
  assert.match(
    getEnrollmentFoundationValidationError({
      academicYearId: "year",
      entryAcademicTerm: null,
      gradeLevel: "11",
      shsTrack: "ACADEMIC",
    }) ?? "",
    /Entry Academic Term is required/,
  );
  assert.match(
    getEnrollmentFoundationValidationError({
      academicYearId: "year",
      entryAcademicTerm: { academicYearId: "year" },
      gradeLevel: "11",
    }) ?? "",
    /SHS Track is required/,
  );
  assert.match(
    getEnrollmentFoundationValidationError({
      academicYearId: "year",
      entryAcademicTerm: { academicYearId: "year" },
      gradeLevel: "7",
      shsTrack: "ACADEMIC",
    }) ?? "",
    /JHS enrollments cannot have/,
  );
  assert.equal(
    getEnrollmentFoundationValidationError({
      academicYearId: "year",
      entryAcademicTerm: null,
      gradeLevel: "7",
    }),
    null,
  );
});

test("service and composite FK reject a cross-year entry Term", async () => {
  await withRollback(async (transaction) => {
    const fixture = await getFoundationFixture(transaction);
    const suffix = 2300 + Math.floor(Math.random() * 100);
    const otherYear = await transaction.academicYear.create({
      data: {
        label: `${suffix}-${suffix + 1}`,
        startDate: new Date(`${suffix}-06-01T00:00:00.000Z`),
        endDate: new Date(`${suffix + 1}-04-01T00:00:00.000Z`),
        createdById: fixture.actor.id,
      },
    });
    const otherTerm = await transaction.academicTerm.create({
      data: {
        academicYearId: otherYear.id,
        name: "Term 1",
        position: 1,
        startDate: new Date(`${suffix}-06-01T00:00:00.000Z`),
        endDate: new Date(`${suffix}-08-01T00:00:00.000Z`),
        createdById: fixture.actor.id,
      },
    });
    assert.match(
      getEnrollmentFoundationValidationError({
        academicYearId: fixture.academicYear.id,
        entryAcademicTerm: { academicYearId: otherYear.id },
        gradeLevel: "11",
        shsTrack: "ACADEMIC",
      }) ?? "",
      /must belong to the selected Academic Year/,
    );

    const databaseFixture = await createStudentAndSection(
      transaction,
      fixture.actor.id,
      "11",
    );
    await assert.rejects(
      transaction.enrollment.create({
        data: {
          studentId: databaseFixture.student.id,
          sectionId: databaseFixture.section.id,
          academicYearId: fixture.academicYear.id,
          entryAcademicTermId: otherTerm.id,
          shsTrack: "ACADEMIC",
          createdById: fixture.actor.id,
        },
      }),
      /Foreign key constraint/i,
    );
  });
});

test("database rejects Grade 11 without Track", async () => {
  await withRollback(async (transaction) => {
    const fixture = await getFoundationFixture(transaction);
    const grade11 = await createStudentAndSection(
      transaction,
      fixture.actor.id,
      "11",
    );
    await assert.rejects(
      transaction.enrollment.create({
        data: {
          studentId: grade11.student.id,
          sectionId: grade11.section.id,
          academicYearId: fixture.academicYear.id,
          entryAcademicTermId: fixture.entryTerm.id,
          createdById: fixture.actor.id,
        },
      }),
      /requires an entry Academic Term and SHS Track/,
    );

  });
});

test("database rejects JHS with Track", async () => {
  await withRollback(async (transaction) => {
    const fixture = await getFoundationFixture(transaction);
    const grade7 = await createStudentAndSection(
      transaction,
      fixture.actor.id,
      "7",
    );
    await assert.rejects(
      transaction.enrollment.create({
        data: {
          studentId: grade7.student.id,
          sectionId: grade7.section.id,
          academicYearId: fixture.academicYear.id,
          shsTrack: "TECHPRO",
          createdById: fixture.actor.id,
        },
      }),
      /JHS Enrollment cannot have/,
    );

  });
});

test("database rejects SHS missing entry Term", async () => {
  await withRollback(async (transaction) => {
    const fixture = await getFoundationFixture(transaction);
    const missingTerm = await createStudentAndSection(
      transaction,
      fixture.actor.id,
      "11",
    );
    await assert.rejects(
      transaction.enrollment.create({
        data: {
          studentId: missingTerm.student.id,
          sectionId: missingTerm.section.id,
          academicYearId: fixture.academicYear.id,
          shsTrack: "ACADEMIC",
          createdById: fixture.actor.id,
        },
      }),
      /requires an entry Academic Term and SHS Track/,
    );
  });
});

test("placement correction preserves facts and rejects SHS to JHS", async () => {
  await withRollback(async (transaction) => {
    const fixture = await getFoundationFixture(transaction);
    const source = await createStudentAndSection(
      transaction,
      fixture.actor.id,
      "11",
    );
    const destinationShs = await createStudentAndSection(
      transaction,
      fixture.actor.id,
      "11",
    );
    const enrollment = await transaction.enrollment.create({
      data: {
        studentId: source.student.id,
        sectionId: source.section.id,
        academicYearId: fixture.academicYear.id,
        entryAcademicTermId: fixture.entryTerm.id,
        shsTrack: "TECHPRO",
        createdById: fixture.actor.id,
      },
    });

    await transaction.enrollment.update({
      where: { id: enrollment.id },
      data: { sectionId: destinationShs.section.id },
    });
    assert.deepEqual(
      await transaction.enrollment.findUniqueOrThrow({
        where: { id: enrollment.id },
        select: { shsTrack: true, entryAcademicTermId: true },
      }),
      { shsTrack: "TECHPRO", entryAcademicTermId: fixture.entryTerm.id },
    );

    assert.match(
      getEnrollmentPlacementCompatibilityError({
        destinationGradeLevel: "7",
        entryAcademicTermId: fixture.entryTerm.id,
        shsTrack: "TECHPRO",
      }) ?? "",
      /cannot move.*SHS Track.*JHS/i,
    );
  });
});

for (const [sourceGrade, targetGrade, shsTrack, expected] of [
  ["11", "7", "ACADEMIC", /SHS Track to JHS/],
  ["7", "11", null, /to SHS without entry Terms and SHS Tracks/],
] as const) {
  test(`Section grade ${sourceGrade} -> ${targetGrade} cannot bypass Enrollment entry facts`, async () => {
    await withRollback(async (transaction) => {
      const fixture = await getFoundationFixture(transaction);
      const { student, section } = await createStudentAndSection(
        transaction,
        fixture.actor.id,
        sourceGrade,
      );
      await transaction.enrollment.create({
        data: {
          studentId: student.id,
          sectionId: section.id,
          academicYearId: fixture.academicYear.id,
          entryAcademicTermId:
            sourceGrade === "11" ? fixture.entryTerm.id : undefined,
          shsTrack,
          createdById: fixture.actor.id,
        },
      });

      await assert.rejects(
        transaction.section.update({
          where: { id: section.id },
          data: { gradeLevel: targetGrade },
        }),
        expected,
      );
    });
  });
}

for (const fact of ["shsTrack", "entryAcademicTerm"] as const) {
test(`populated Enrollment ${fact} is write-once`, async () => {
  await withRollback(async (transaction) => {
    const fixture = await getFoundationFixture(transaction);
    const { student, section } = await createStudentAndSection(
      transaction,
      fixture.actor.id,
      "11",
    );
    const enrollment = await transaction.enrollment.create({
      data: {
        studentId: student.id,
        sectionId: section.id,
        academicYearId: fixture.academicYear.id,
        entryAcademicTermId: fixture.entryTerm.id,
        shsTrack: "ACADEMIC",
        createdById: fixture.actor.id,
      },
    });
    const anotherTerm = await transaction.academicTerm.findFirstOrThrow({
      where: {
        academicYearId: fixture.academicYear.id,
        id: { not: fixture.entryTerm.id },
      },
      select: { id: true },
    });

    await assert.rejects(
      transaction.enrollment.update({
        where: { id: enrollment.id },
        data:
          fact === "shsTrack"
            ? { shsTrack: "TECHPRO" }
            : { entryAcademicTermId: anotherTerm.id },
      }),
      fact === "shsTrack"
        ? /SHS Track is immutable once populated/
        : /entry Academic Term is immutable once populated/,
    );
  });
});
}

test("legacy null fields remain readable and migration performs no backfill", async () => {
  const migration = readFileSync(
    path.join(
      process.cwd(),
      "prisma/migrations/20260818000000_phase21d_a_enrollment_foundation/migration.sql",
    ),
    "utf8",
  );
  assert.doesNotMatch(migration, /UPDATE\s+"Enrollment"/i);

  const legacyRows = await prisma.enrollment.findMany({
    where: { entryAcademicTermId: null, shsTrack: null },
    select: { id: true, status: true },
  });
  assert.equal(legacyRows.every(({ id, status }) => Boolean(id && status)), true);
});

test("Enrollment service wires validation, persistence, synchronization, and audit", () => {
  const service = readFileSync(
    path.join(process.cwd(), "services/enrollment.service.ts"),
    "utf8",
  );
  assert.match(service, /lockAcademicTermForEnrollment/);
  assert.match(service, /getEnrollmentFoundationValidationError/);
  assert.match(service, /entryAcademicTermId: entryAcademicTerm\?\.id \?\? null/);
  assert.match(service, /shsTrack: values\.shsTrack \?\? null/);
  assert.match(service, /updateStudentEnrollmentSummary/);
  assert.match(service, /deriveApprovedRegularJhsStudentSubjectEnrollments/);
  assert.match(service, /changes\.entryAcademicTerm =/);
  assert.match(service, /createAuditLogs/);
});

test("permissions and layered authorization remain unchanged", () => {
  assert.equal(hasPermission("SUPER_ADMIN", Permissions.ENROLLMENT), true);
  assert.equal(hasPermission("REGISTRAR", Permissions.ENROLLMENT), true);
  assert.equal(hasPermission("PRINCIPAL", Permissions.ENROLLMENT), false);
  assert.equal(hasPermission("TEACHER", Permissions.ENROLLMENT), false);

  const action = readFileSync(
    path.join(process.cwd(), "actions/enrollment.action.ts"),
    "utf8",
  );
  const service = readFileSync(
    path.join(process.cwd(), "services/enrollment.service.ts"),
    "utf8",
  );
  assert.match(action, /requirePermission\(Permissions\.ENROLLMENT\)/);
  assert.match(service, /requirePermission\(Permissions\.ENROLLMENT\)/);
});

test("form clears entry Term and shows entry Term and Track only for SHS", () => {
  const form = readFileSync(
    path.join(
      process.cwd(),
      "app/(protected)/dashboard/enrollment/components/enrollment-form.tsx",
    ),
    "utf8",
  );
  assert.match(form, /useWatch/);
  assert.match(form, /previousAcademicYearId\.current !== selectedAcademicYearId/);
  assert.match(form, /setValue\("entryAcademicTermId", ""/);
  assert.match(form, /selectedSection\?\.gradeLevel === "11"/);
  assert.match(form, /selectedSection\?\.gradeLevel === "12"/);
  assert.match(form, /\{isShs \? \(/);
  assert.match(form, /\{isShs && selectedAcademicYearId \? \(/);
  assert.match(form, /setValue\("entryAcademicTermId", undefined/);
  assert.match(form, /setValue\("shsTrack", undefined/);
});
