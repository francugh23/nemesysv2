import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

export function findStudentEnrollmentCorrectionReference(
  enrollmentId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).enrollment.findFirst({
    where: { id: enrollmentId, deletedAt: null },
    select: { id: true, studentId: true },
  });
}

export function findStudentEnrollmentCorrectionContext(
  enrollmentId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.enrollment.findFirst({
    where: { id: enrollmentId, deletedAt: null },
    select: {
      id: true,
      sectionId: true,
      section: { select: { gradeLevel: true, sectionName: true } },
      _count: { select: { studentSubjectEnrollments: true } },
    },
  });
}

export function findStudentEnrollmentCorrectionHistory(
  enrollmentId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.$queryRaw<Array<{
    id: string;
    correctionType: "PLACEMENT" | "GRADE_LEVEL";
    sourcePlacementSnapshot: Prisma.JsonValue;
    destinationPlacementSnapshot: Prisma.JsonValue;
    reason: string;
    evidenceReference: string;
    sourceParticipationCount: number | null;
    replacementParticipationCount: number | null;
    correctedAt: Date;
    correctedByFirstName: string;
    correctedByMiddleName: string | null;
    correctedByLastName: string;
  }>>(Prisma.sql`
    SELECT correction."id", 'PLACEMENT'::TEXT AS "correctionType",
           correction."sourcePlacementSnapshot",
           correction."destinationPlacementSnapshot", correction."reason",
           correction."evidenceReference", NULL::INTEGER AS "sourceParticipationCount",
           NULL::INTEGER AS "replacementParticipationCount", correction."correctedAt",
           actor."firstName" AS "correctedByFirstName",
           actor."middleName" AS "correctedByMiddleName",
           actor."lastName" AS "correctedByLastName"
    FROM "StudentEnrollmentCorrection" correction
    JOIN "User" actor ON actor."id" = correction."correctedById"
    WHERE correction."enrollmentId" = ${enrollmentId}
    UNION ALL
    SELECT correction."id", 'GRADE_LEVEL'::TEXT AS "correctionType",
           correction."sourcePlacementSnapshot",
           correction."destinationPlacementSnapshot", correction."reason",
           correction."evidenceReference", correction."sourceParticipationCount",
           correction."replacementParticipationCount", correction."correctedAt",
           actor."firstName" AS "correctedByFirstName",
           actor."middleName" AS "correctedByMiddleName",
           actor."lastName" AS "correctedByLastName"
    FROM "StudentEnrollmentGradeCorrection" correction
    JOIN "User" actor ON actor."id" = correction."correctedById"
    WHERE correction."enrollmentId" = ${enrollmentId}
    ORDER BY "correctedAt" DESC, "id" DESC
  `);
}

export function findSameGradePlacementDestinations(
  gradeLevel: string,
  sourceSectionId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.section.findMany({
    where: { gradeLevel, id: { not: sourceSectionId }, deletedAt: null },
    select: { id: true, gradeLevel: true, sectionName: true },
    orderBy: [{ sectionName: "asc" }, { id: "asc" }],
  });
}

export function findRegularJhsGradeCorrectionDestinations(
  sourceSectionId: string,
  sourceGradeLevel: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.section.findMany({
    where: {
      id: { not: sourceSectionId },
      gradeLevel: { in: ["7", "8", "9", "10"], not: sourceGradeLevel },
      deletedAt: null,
    },
    select: { id: true, gradeLevel: true, sectionName: true },
    orderBy: [{ gradeLevel: "asc" }, { sectionName: "asc" }, { id: "asc" }],
  });
}

export async function lockEnrollmentForStudentCorrection(
  enrollmentId: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{
    id: string;
    studentId: string;
    sectionId: string;
    academicYearId: string;
    status: string;
    deletedAt: Date | null;
    shsTrack: string | null;
    entryAcademicTermId: string | null;
  }>>(Prisma.sql`
    SELECT "id", "studentId", "sectionId", "academicYearId", "status",
           "deletedAt", "shsTrack", "entryAcademicTermId"
    FROM "Enrollment"
    WHERE "id" = ${enrollmentId}
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export async function lockAcademicYearForStudentCorrection(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string; label: string; status: string }>>(Prisma.sql`
    SELECT "id", "label", "status" FROM "AcademicYear"
    WHERE "id" = ${academicYearId}
    FOR SHARE
  `);
  return rows[0] ?? null;
}

export async function lockSectionsForStudentCorrection(
  sectionIds: string[],
  transaction: Prisma.TransactionClient,
) {
  return transaction.$queryRaw<Array<{
    id: string;
    gradeLevel: string;
    sectionName: string;
    deletedAt: Date | null;
  }>>(Prisma.sql`
    SELECT "id", "gradeLevel", "sectionName", "deletedAt"
    FROM "Section"
    WHERE "id" IN (${Prisma.join([...new Set(sectionIds)].sort())})
    ORDER BY "id"
    FOR SHARE
  `);
}

export function lockStudentCorrectionConflicts(
  enrollmentId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id" FROM "StudentEnrollmentCorrection"
    WHERE "enrollmentId" = ${enrollmentId}
    ORDER BY "id" FOR SHARE
  `);
}

export function countStudentEnrollmentCorrectionParticipationImpact(
  enrollmentId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.studentSubjectEnrollment.count({ where: { enrollmentId } });
}

export function createStudentEnrollmentCorrection(
  data: Prisma.StudentEnrollmentCorrectionUncheckedCreateInput,
  transaction: Prisma.TransactionClient,
) {
  return transaction.studentEnrollmentCorrection.create({ data, select: { id: true } });
}

export function setStudentEnrollmentCorrectionContext(
  correctionId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.$queryRaw<Array<{ set_config: string }>>`
    SELECT set_config('nemesys.student_enrollment_correction_id', ${correctionId}, true)
  `;
}

export function forceStudentEnrollmentCorrectionValidation(transaction: Prisma.TransactionClient) {
  return transaction.$executeRawUnsafe(
    'SET CONSTRAINTS "StudentEnrollmentCorrection_completion_trigger", "StudentEnrollmentCorrection_student_revalidation_trigger", "StudentEnrollmentCorrection_enrollment_revalidation_trigger", "StudentEnrollmentCorrection_academic_year_revalidation_trigger", "StudentEnrollmentCorrection_section_revalidation_trigger", "StudentEnrollmentCorrection_created_at_completion_trigger", "StudentEnrollmentCorrection_created_at_revalidation_trigger", "StudentEnrollmentCorrection_section_mutation_isolation_trigger", "StudentEnrollmentCorrection_active_participants_completion_trigger", "StudentEnrollmentCorrection_student_active_revalidation_trigger", "StudentEnrollmentCorrection_source_section_active_revalidation_trigger" IMMEDIATE',
  );
}

export function deferStudentEnrollmentCorrectionValidation(transaction: Prisma.TransactionClient) {
  return transaction.$executeRawUnsafe(
    'SET CONSTRAINTS "StudentEnrollmentCorrection_completion_trigger", "StudentEnrollmentCorrection_student_revalidation_trigger", "StudentEnrollmentCorrection_enrollment_revalidation_trigger", "StudentEnrollmentCorrection_academic_year_revalidation_trigger", "StudentEnrollmentCorrection_section_revalidation_trigger", "StudentEnrollmentCorrection_created_at_completion_trigger", "StudentEnrollmentCorrection_created_at_revalidation_trigger", "StudentEnrollmentCorrection_section_mutation_isolation_trigger", "StudentEnrollmentCorrection_active_participants_completion_trigger", "StudentEnrollmentCorrection_student_active_revalidation_trigger", "StudentEnrollmentCorrection_source_section_active_revalidation_trigger" DEFERRED',
  );
}
