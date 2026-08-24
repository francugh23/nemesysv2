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

export function findStudentEnrollmentCorrectionContext(enrollmentId: string) {
  return prisma.enrollment.findFirst({
    where: { id: enrollmentId, deletedAt: null },
    select: {
      id: true,
      sectionId: true,
      section: { select: { gradeLevel: true, trackStrand: true, sectionName: true } },
      _count: { select: { studentSubjectEnrollments: true } },
      placementCorrections: {
        select: {
          id: true,
          sourcePlacementSnapshot: true,
          destinationPlacementSnapshot: true,
          reason: true,
          evidenceReference: true,
          correctedAt: true,
          correctedBy: { select: { firstName: true, middleName: true, lastName: true } },
        },
        orderBy: [{ correctedAt: "desc" }, { id: "desc" }],
      },
    },
  });
}

export function findSameGradePlacementDestinations(gradeLevel: string, sourceSectionId: string) {
  return prisma.section.findMany({
    where: { gradeLevel, id: { not: sourceSectionId }, deletedAt: null },
    select: { id: true, gradeLevel: true, trackStrand: true, sectionName: true },
    orderBy: [{ trackStrand: "asc" }, { sectionName: "asc" }, { id: "asc" }],
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
    trackStrand: string | null;
    sectionName: string;
    deletedAt: Date | null;
  }>>(Prisma.sql`
    SELECT "id", "gradeLevel", "trackStrand", "sectionName", "deletedAt"
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
