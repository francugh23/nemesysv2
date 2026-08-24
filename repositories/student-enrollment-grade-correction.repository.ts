import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

export type LockedGradeCorrectionEnrollment = {
  id: string;
  studentId: string;
  sectionId: string;
  academicYearId: string;
  status: string;
  deletedAt: Date | null;
  shsTrack: string | null;
  entryAcademicTermId: string | null;
  semester: string | null;
  createdById: string;
  createdAt: Date;
};

export type LockedGradeCorrectionSection = {
  id: string;
  gradeLevel: string;
  trackStrand: string | null;
  sectionName: string;
  deletedAt: Date | null;
};

export type LockedGradeCorrectionAcademicYear = {
  id: string;
  label: string;
  status: string;
  terms: Array<{
    id: string;
    name: string;
    position: number;
    startDate: Date;
    endDate: Date;
  }>;
};

export type LockedGradeCorrectionSse = {
  id: string;
  subjectOfferingId: string;
  subjectCode: string;
  subjectDescription: string;
  gradeLevel: string;
  selectionAcademicTermId: string | null;
  shsClassification: string | null;
  status: string;
  replacedAt: Date | null;
  droppedAt: Date | null;
  offering: {
    id: string;
    academicYearId: string;
    gradeLevel: string;
    subjectCode: string;
    subjectDescription: string;
    deletedAt: Date | null;
    shsContextId: string | null;
    terms: Array<{
      academicTermId: string;
      academicYearId: string;
    }>;
  };
  terms: Array<{
    academicTermId: string;
    name: string;
    position: number;
    resultId: string | null;
  }>;
};

export type LockedGradeCorrectionOffering = {
  id: string;
  subjectId: string;
  academicYearId: string;
  gradeLevel: string;
  subjectCode: string;
  subjectDescription: string;
  deletedAt: Date | null;
  replacesSubjectOfferingId: string | null;
  replacementSubjectOfferingId: string | null;
  shsContextId: string | null;
  subjectCodeCurrent: string;
  subjectDescriptionCurrent: string;
  subjectGradeLevel: string;
  subjectTrackStrand: string | null;
  subjectDeletedAt: Date | null;
  terms: Array<{
    academicTermId: string;
    academicYearId: string;
    name: string;
    position: number;
  }>;
};

export function findGradeCorrectionReference(enrollmentId: string, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).enrollment.findFirst({
    where: { id: enrollmentId, deletedAt: null },
    select: { id: true, studentId: true },
  });
}

export function findGradeCorrectionPreviewContext(enrollmentId: string) {
  return prisma.enrollment.findFirst({
    where: { id: enrollmentId, deletedAt: null },
    select: {
      id: true,
      studentId: true,
      sectionId: true,
      academicYearId: true,
      status: true,
      shsTrack: true,
      entryAcademicTermId: true,
      student: { select: { status: true, currentSectionId: true, deletedAt: true } },
      section: { select: { gradeLevel: true, trackStrand: true, sectionName: true, deletedAt: true } },
      academicYear: {
        select: {
          status: true,
          terms: {
            select: { id: true, name: true, position: true, startDate: true, endDate: true },
            orderBy: [{ position: "asc" }, { id: "asc" }],
          },
        },
      },
      studentSubjectEnrollments: {
        select: {
          id: true,
          subjectCode: true,
          subjectDescription: true,
          gradeLevel: true,
          status: true,
          selectionAcademicTermId: true,
          shsClassification: true,
          subjectOffering: {
            select: {
              id: true,
              academicYearId: true,
              gradeLevel: true,
              subjectCode: true,
              subjectDescription: true,
              deletedAt: true,
              shsContext: { select: { subjectOfferingId: true } },
              terms: {
                select: {
                  academicTermId: true,
                  academicTerm: { select: { academicYearId: true } },
                },
                orderBy: { academicTerm: { position: "asc" } },
              },
            },
          },
          terms: {
            select: {
              academicTermId: true,
              academicTerm: { select: { name: true, position: true } },
              result: { select: { id: true } },
            },
            orderBy: { academicTerm: { position: "asc" } },
          },
        },
        orderBy: [{ subjectCode: "asc" }, { id: "asc" }],
      },
    },
  });
}

export function findRegularJhsGradeCorrectionDestinations(
  sourceSectionId: string,
  sourceGradeLevel: string,
) {
  return prisma.section.findMany({
    where: {
      id: { not: sourceSectionId },
      gradeLevel: { in: ["7", "8", "9", "10"], not: sourceGradeLevel },
      trackStrand: null,
      deletedAt: null,
    },
    select: { id: true, gradeLevel: true, trackStrand: true, sectionName: true },
    orderBy: [{ gradeLevel: "asc" }, { sectionName: "asc" }, { id: "asc" }],
  });
}

export function findGradeCorrectionDestinationSection(sectionId: string) {
  return prisma.section.findFirst({
    where: { id: sectionId },
    select: { id: true, gradeLevel: true, trackStrand: true, sectionName: true, deletedAt: true },
  });
}

export function findGradeCorrectionDestinationOfferings(academicYearId: string, expectedCodes: string[]) {
  return prisma.subjectOffering.findMany({
    where: { academicYearId, subjectCode: { in: expectedCodes }, deletedAt: null },
    select: {
      id: true,
      subjectId: true,
      academicYearId: true,
      gradeLevel: true,
      subjectCode: true,
      subjectDescription: true,
      deletedAt: true,
      replacesSubjectOfferingId: true,
      replacementSubjectOffering: { select: { id: true } },
      shsContext: { select: { subjectOfferingId: true } },
      subject: {
        select: { code: true, description: true, gradeLevel: true, trackStrand: true, deletedAt: true },
      },
      terms: {
        select: {
          academicTermId: true,
          academicTerm: { select: { academicYearId: true, name: true, position: true } },
        },
        orderBy: { academicTerm: { position: "asc" } },
      },
    },
    orderBy: [{ subjectCode: "asc" }, { id: "asc" }],
  });
}

export async function lockGradeCorrectionEnrollment(enrollmentId: string, transaction: Prisma.TransactionClient) {
  const rows = await transaction.$queryRaw<LockedGradeCorrectionEnrollment[]>(Prisma.sql`
    SELECT "id", "studentId", "sectionId", "academicYearId", "status", "deletedAt",
           "shsTrack", "entryAcademicTermId", "semester", "createdById", "createdAt"
    FROM "Enrollment"
    WHERE "id" = ${enrollmentId}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export async function lockGradeCorrectionAcademicYear(academicYearId: string, transaction: Prisma.TransactionClient) {
  const years = await transaction.$queryRaw<Array<{ id: string; label: string; status: string }>>(Prisma.sql`
    SELECT "id", "label", "status" FROM "AcademicYear"
    WHERE "id" = ${academicYearId}
    FOR SHARE
  `);
  if (!years[0]) return null;
  const terms = await transaction.$queryRaw<LockedGradeCorrectionAcademicYear["terms"]>(Prisma.sql`
    SELECT "id", "name", "position", "startDate", "endDate"
    FROM "AcademicTerm"
    WHERE "academicYearId" = ${academicYearId}
    ORDER BY "position", "id"
    FOR SHARE
  `);
  return { ...years[0], terms };
}

export function lockGradeCorrectionSections(sectionIds: string[], transaction: Prisma.TransactionClient) {
  return transaction.$queryRaw<LockedGradeCorrectionSection[]>(Prisma.sql`
    SELECT "id", "gradeLevel", "trackStrand", "sectionName", "deletedAt"
    FROM "Section"
    WHERE "id" IN (${Prisma.join([...new Set(sectionIds)].sort())})
    ORDER BY "id"
    FOR SHARE
  `);
}

export async function lockGradeCorrectionConflicts(enrollmentId: string, transaction: Prisma.TransactionClient) {
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id" FROM "StudentEnrollmentCorrection"
    WHERE "enrollmentId" = ${enrollmentId}
    ORDER BY "id" FOR SHARE
  `);
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id" FROM "StudentEnrollmentGradeCorrection"
    WHERE "enrollmentId" = ${enrollmentId}
    ORDER BY "id" FOR SHARE
  `);
}

export async function lockGradeCorrectionSourceEvidence(enrollmentId: string, transaction: Prisma.TransactionClient) {
  const rows = await transaction.$queryRaw<Array<Omit<LockedGradeCorrectionSse, "terms">>>(Prisma.sql`
    SELECT "id", "subjectOfferingId", "subjectCode", "subjectDescription", "gradeLevel",
           "selectionAcademicTermId", "shsClassification", "status", "replacedAt", "droppedAt"
    FROM "StudentSubjectEnrollment"
    WHERE "enrollmentId" = ${enrollmentId}
    ORDER BY "id"
    FOR UPDATE
  `);
  if (!rows.length) return [];
  const terms = await transaction.$queryRaw<Array<{
    studentSubjectEnrollmentId: string;
    academicTermId: string;
    name: string;
    position: number;
  }>>(Prisma.sql`
    SELECT sset."studentSubjectEnrollmentId", sset."academicTermId", term."name", term."position"
    FROM "StudentSubjectEnrollmentTerm" sset
    JOIN "AcademicTerm" term ON term."id" = sset."academicTermId"
    WHERE sset."studentSubjectEnrollmentId" IN (${Prisma.join(rows.map(({ id }) => id))})
    ORDER BY sset."studentSubjectEnrollmentId", term."position", sset."academicTermId"
    FOR UPDATE OF sset
  `);
  const results = await transaction.$queryRaw<Array<{
    id: string;
    studentSubjectEnrollmentId: string;
    academicTermId: string;
  }>>(Prisma.sql`
    SELECT "id", "studentSubjectEnrollmentId", "academicTermId"
    FROM "ShsTermResult"
    WHERE "studentSubjectEnrollmentId" IN (${Prisma.join(rows.map(({ id }) => id))})
    ORDER BY "studentSubjectEnrollmentId", "academicTermId", "id"
    FOR UPDATE
  `);
  const offerings = await transaction.$queryRaw<Array<{
    id: string;
    academicYearId: string;
    gradeLevel: string;
    subjectCode: string;
    subjectDescription: string;
    deletedAt: Date | null;
    shsContextId: string | null;
  }>>(Prisma.sql`
    SELECT offering."id", offering."academicYearId", offering."gradeLevel",
           offering."subjectCode", offering."subjectDescription", offering."deletedAt",
           shs."subjectOfferingId" AS "shsContextId"
    FROM "SubjectOffering" offering
    LEFT JOIN "SubjectOfferingShsContext" shs ON shs."subjectOfferingId" = offering."id"
    WHERE offering."id" IN (${Prisma.join(rows.map(({ subjectOfferingId }) => subjectOfferingId))})
    ORDER BY offering."id"
    FOR SHARE OF offering
  `);
  const offeringTerms = await transaction.$queryRaw<Array<{
    subjectOfferingId: string;
    academicTermId: string;
    academicYearId: string;
  }>>(Prisma.sql`
    SELECT membership."subjectOfferingId", membership."academicTermId", term."academicYearId"
    FROM "SubjectOfferingTerm" membership
    JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
    WHERE membership."subjectOfferingId" IN (${Prisma.join(rows.map(({ subjectOfferingId }) => subjectOfferingId))})
    ORDER BY membership."subjectOfferingId", term."position", membership."academicTermId"
    FOR SHARE OF membership, term
  `);
  return rows.map((row) => ({
    ...row,
    terms: terms.filter((term) => term.studentSubjectEnrollmentId === row.id).map((term) => ({
      ...term,
      resultId: results.find((result) =>
        result.studentSubjectEnrollmentId === term.studentSubjectEnrollmentId &&
        result.academicTermId === term.academicTermId)?.id ?? null,
    })),
    offering: {
      ...offerings.find((offering) => offering.id === row.subjectOfferingId)!,
      terms: offeringTerms.filter((term) => term.subjectOfferingId === row.subjectOfferingId),
    },
  }));
}

export async function lockGradeCorrectionDestinationOfferings(
  academicYearId: string,
  expectedCodes: string[],
  transaction: Prisma.TransactionClient,
): Promise<LockedGradeCorrectionOffering[]> {
  if (!expectedCodes.length) return [];
  const offerings = await transaction.$queryRaw<Array<Omit<LockedGradeCorrectionOffering, "terms">>>(Prisma.sql`
    SELECT offering."id", offering."subjectId", offering."academicYearId", offering."gradeLevel",
           offering."subjectCode", offering."subjectDescription", offering."deletedAt",
           offering."replacesSubjectOfferingId",
           replacement."id" AS "replacementSubjectOfferingId",
           shs."subjectOfferingId" AS "shsContextId",
           subject."code" AS "subjectCodeCurrent", subject."description" AS "subjectDescriptionCurrent",
           subject."gradeLevel" AS "subjectGradeLevel", subject."trackStrand" AS "subjectTrackStrand",
           subject."deletedAt" AS "subjectDeletedAt"
    FROM "SubjectOffering" offering
    JOIN "Subject" subject ON subject."id" = offering."subjectId"
    LEFT JOIN "SubjectOffering" replacement ON replacement."replacesSubjectOfferingId" = offering."id"
    LEFT JOIN "SubjectOfferingShsContext" shs ON shs."subjectOfferingId" = offering."id"
    WHERE offering."academicYearId" = ${academicYearId}
      AND offering."subjectCode" IN (${Prisma.join(expectedCodes)})
      AND offering."deletedAt" IS NULL
    ORDER BY offering."id"
    FOR SHARE OF offering, subject
  `);
  if (!offerings.length) return [];
  const terms = await transaction.$queryRaw<Array<{
    subjectOfferingId: string;
    academicTermId: string;
    academicYearId: string;
    name: string;
    position: number;
  }>>(Prisma.sql`
    SELECT sot."subjectOfferingId", sot."academicTermId", term."academicYearId", term."name", term."position"
    FROM "SubjectOfferingTerm" sot
    JOIN "AcademicTerm" term ON term."id" = sot."academicTermId"
    WHERE sot."subjectOfferingId" IN (${Prisma.join(offerings.map(({ id }) => id))})
    ORDER BY sot."subjectOfferingId", term."position", sot."academicTermId"
    FOR SHARE OF sot, term
  `);
  return offerings.map((offering) => ({
    ...offering,
    terms: terms.filter((term) => term.subjectOfferingId === offering.id),
  }));
}

export function createGradeCorrectionIntent(
  data: {
    id: string;
    enrollmentId: string;
    sourceSectionId: string;
    destinationSectionId: string;
    sourcePlacementSnapshot: Prisma.InputJsonValue;
    destinationPlacementSnapshot: Prisma.InputJsonValue;
    enrollmentCreatedAtSnapshot: Date;
    sourceParticipationCount: number;
    replacementParticipationCount: number;
    reason: string;
    evidenceReference: string;
    correctedById: string;
    correctedAt: Date;
  },
  transaction: Prisma.TransactionClient,
) {
  return transaction.$executeRaw(Prisma.sql`
    INSERT INTO "StudentEnrollmentGradeCorrection" (
      "id", "enrollmentId", "sourceSectionId", "destinationSectionId",
      "sourcePlacementSnapshot", "destinationPlacementSnapshot", "enrollmentCreatedAtSnapshot",
      "reason", "evidenceReference", "sourceParticipationCount", "replacementParticipationCount",
      "correctedById", "correctedAt", "createdAt"
    ) VALUES (
      ${data.id}, ${data.enrollmentId}, ${data.sourceSectionId}, ${data.destinationSectionId},
      ${JSON.stringify(data.sourcePlacementSnapshot)}::jsonb,
      ${JSON.stringify(data.destinationPlacementSnapshot)}::jsonb,
      ${data.enrollmentCreatedAtSnapshot}, ${data.reason}, ${data.evidenceReference},
      ${data.sourceParticipationCount}, ${data.replacementParticipationCount},
      ${data.correctedById}, ${data.correctedAt}, ${data.correctedAt}
    )
  `);
}

export function setGradeCorrectionCapability(correctionId: string, transaction: Prisma.TransactionClient) {
  return transaction.$queryRaw<Array<{ set_config: string }>>`
    SELECT set_config('nemesys.student_enrollment_grade_correction_id', ${correctionId}, true)
  `;
}

export function replaceGradeCorrectionSourceSse(id: string, replacedAt: Date, transaction: Prisma.TransactionClient) {
  return transaction.studentSubjectEnrollment.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "REPLACED", replacedAt },
  });
}

export function createGradeCorrectionDestinationSse(
  enrollmentId: string,
  offering: LockedGradeCorrectionOffering,
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.studentSubjectEnrollment.create({
    data: {
      enrollmentId,
      subjectOfferingId: offering.id,
      subjectCode: offering.subjectCode,
      subjectDescription: offering.subjectDescription,
      gradeLevel: offering.gradeLevel,
      createdById: actorId,
      terms: { create: offering.terms.map(({ academicTermId }) => ({ academicTermId })) },
    },
    select: { id: true, subjectOfferingId: true, subjectCode: true, subjectDescription: true },
  });
}

export function createGradeCorrectionSubjectLink(
  data: {
    id: string;
    correctionId: string;
    canonicalSubjectPrefix: string;
    sourceStudentSubjectEnrollmentId: string;
    replacementStudentSubjectEnrollmentId: string;
    sourceParticipationSnapshot: Prisma.InputJsonValue;
    replacementParticipationSnapshot: Prisma.InputJsonValue;
  },
  transaction: Prisma.TransactionClient,
) {
  return transaction.$executeRaw(Prisma.sql`
    INSERT INTO "StudentParticipationCorrection" (
      "id", "studentEnrollmentGradeCorrectionId", "canonicalSubjectPrefix",
      "sourceStudentSubjectEnrollmentId", "replacementStudentSubjectEnrollmentId",
      "sourceParticipationSnapshot", "replacementParticipationSnapshot", "createdAt"
    ) VALUES (
      ${data.id}, ${data.correctionId}, ${data.canonicalSubjectPrefix},
      ${data.sourceStudentSubjectEnrollmentId}, ${data.replacementStudentSubjectEnrollmentId},
      ${JSON.stringify(data.sourceParticipationSnapshot)}::jsonb,
      ${JSON.stringify(data.replacementParticipationSnapshot)}::jsonb, NOW()
    )
  `);
}

export function forceGradeCorrectionValidation(transaction: Prisma.TransactionClient) {
  return transaction.$executeRawUnsafe(
    'SET CONSTRAINTS "StudentEnrollmentGradeCorrection_completion_trigger", "StudentParticipationCorrection_completion_trigger", "StudentEnrollmentGradeCorrection_sse_revalidation_trigger", "StudentEnrollmentGradeCorrection_sse_term_revalidation_trigger" IMMEDIATE',
  );
}

export function deferGradeCorrectionValidation(transaction: Prisma.TransactionClient) {
  return transaction.$executeRawUnsafe(
    'SET CONSTRAINTS "StudentEnrollmentGradeCorrection_completion_trigger", "StudentParticipationCorrection_completion_trigger", "StudentEnrollmentGradeCorrection_sse_revalidation_trigger", "StudentEnrollmentGradeCorrection_sse_term_revalidation_trigger" DEFERRED',
  );
}
