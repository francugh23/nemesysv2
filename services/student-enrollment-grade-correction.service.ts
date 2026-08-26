import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import {
  findGradeCorrectionDestinationOfferings,
  findGradeCorrectionDestinationSection,
  findGradeCorrectionPreviewContext,
} from "@/repositories/student-enrollment-grade-correction.repository";
import type {
  CorrectStudentEnrollmentGradePlacementInput,
  StudentEnrollmentGradeCorrectionPreview,
} from "@/schemas";
import {
  correctStudentEnrollmentGradePlacementInTransaction,
  getGradeCorrectionTypedConfirmationPhrase,
  getRegularJhsExpectedCodes,
  gradeCorrectionRequiresTypedConfirmation,
  StudentEnrollmentGradeCorrectionError,
  validateRegularJhsGradeCorrection,
} from "@/services/student-enrollment-grade-correction-mutation.service";

export { StudentEnrollmentGradeCorrectionError } from "@/services/student-enrollment-grade-correction-mutation.service";

const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; meta?: { code?: unknown }; cause?: unknown };
  return candidate.code === "40001" || candidate.code === "40P01" ||
    candidate.meta?.code === "40001" || candidate.meta?.code === "40P01" ||
    isRetryableTransactionError(candidate.cause);
}

export async function getStudentEnrollmentGradeCorrectionPreviewService(
  enrollmentId: string,
  destinationSectionId: string,
  clock: () => Date = () => new Date(),
): Promise<StudentEnrollmentGradeCorrectionPreview> {
  await requirePermission(Permissions.STUDENT_CORRECTIONS);
  const enrollment = await findGradeCorrectionPreviewContext(enrollmentId);
  if (!enrollment) throw new StudentEnrollmentGradeCorrectionError("Enrollment not found.");
  const destination = await findGradeCorrectionDestinationSection(destinationSectionId);
  if (!destination) throw new StudentEnrollmentGradeCorrectionError("Destination Section not found.");

  const expectedCodes = getRegularJhsExpectedCodes(destination.gradeLevel);
  const offerings = expectedCodes.length
    ? await findGradeCorrectionDestinationOfferings(enrollment.academicYearId, expectedCodes)
    : [];
  const sourceSubjects = enrollment.studentSubjectEnrollments.map((row) => ({
    id: row.id,
    subjectCode: row.subjectCode,
    subjectDescription: row.subjectDescription,
    gradeLevel: row.gradeLevel,
    status: row.status,
    selectionAcademicTermId: row.selectionAcademicTermId,
    shsClassification: row.shsClassification,
    termIds: row.terms.map(({ academicTermId }) => academicTermId),
    resultCount: row.terms.filter(({ result }) => result !== null).length,
    offering: {
      academicYearId: row.subjectOffering.academicYearId,
      gradeLevel: row.subjectOffering.gradeLevel,
      subjectCode: row.subjectOffering.subjectCode,
      subjectDescription: row.subjectOffering.subjectDescription,
      shsContextId: row.subjectOffering.shsContext?.subjectOfferingId ?? null,
      termIds: row.subjectOffering.terms.map(({ academicTermId }) => academicTermId),
      termAcademicYearIds: row.subjectOffering.terms.map(({ academicTerm }) => academicTerm.academicYearId),
    },
  }));
  const destinationOfferings = offerings.map((offering) => ({
    id: offering.id,
    academicYearId: offering.academicYearId,
    gradeLevel: offering.gradeLevel,
    subjectCode: offering.subjectCode,
    subjectDescription: offering.subjectDescription,
    deletedAt: offering.deletedAt,
    replacementSubjectOfferingId: offering.replacementSubjectOffering?.id ?? null,
    shsContextId: offering.shsContext?.subjectOfferingId ?? null,
    subjectCodeCurrent: offering.subject.code,
    subjectDescriptionCurrent: offering.subject.description,
    subjectGradeLevel: offering.subject.gradeLevel,
    subjectDeletedAt: offering.subject.deletedAt,
    termIds: offering.terms.map(({ academicTermId }) => academicTermId),
    termAcademicYearIds: offering.terms.map(({ academicTerm }) => academicTerm.academicYearId),
  }));
  const academicYear = {
    id: enrollment.academicYearId,
    label: "",
    status: enrollment.academicYear.status,
    terms: enrollment.academicYear.terms,
  };
  const blockers = validateRegularJhsGradeCorrection({
    enrollment: { ...enrollment, deletedAt: null },
    student: enrollment.student,
    academicYear,
    sourceSection: { id: enrollment.sectionId, ...enrollment.section },
    destinationSection: destination,
    sourceSubjects,
    destinationOfferings,
  });
  const resultBlockers = sourceSubjects
    .filter(({ resultCount }) => resultCount > 0)
    .map(({ id, subjectCode, resultCount }) => ({
      studentSubjectEnrollmentId: id,
      subjectCode,
      resultCount,
    }));
  const previewedAt = clock();
  const requiresTypedConfirmation = gradeCorrectionRequiresTypedConfirmation(academicYear.terms, previewedAt);

  return {
    enrollmentId: enrollment.id,
    sourceSectionId: enrollment.sectionId,
    destinationSectionId: destination.id,
    sourceGradeLevel: enrollment.section.gradeLevel,
    destinationGradeLevel: destination.gradeLevel,
    eligible: blockers.length === 0,
    blockers,
    resultBlockers,
    sourceSubjects: enrollment.studentSubjectEnrollments.map((row) => ({
      subjectCode: row.subjectCode,
      subjectDescription: row.subjectDescription,
      gradeLevel: row.gradeLevel,
      termNames: row.terms.map(({ academicTerm }) => academicTerm.name),
      resultBlockers: row.terms
        .filter(({ result }) => result !== null)
        .map(({ academicTerm }) => `${academicTerm.name} has an attached result.`),
    })),
    destinationSubjects: offerings.map((offering) => ({
      subjectCode: offering.subjectCode,
      subjectDescription: offering.subjectDescription,
      gradeLevel: offering.gradeLevel,
      termNames: offering.terms.map(({ academicTerm }) => academicTerm.name),
      resultBlockers: [],
    })),
    requiresTypedConfirmation,
    typedConfirmationPhrase: getGradeCorrectionTypedConfirmationPhrase(
      enrollment.section.gradeLevel,
      destination.gradeLevel,
    ),
  };
}

export async function correctStudentEnrollmentGradePlacementService(
  enrollmentId: string,
  values: CorrectStudentEnrollmentGradePlacementInput,
) {
  const session = await requirePermission(Permissions.STUDENT_CORRECTIONS);
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        (transaction) => correctStudentEnrollmentGradePlacementInTransaction(
          enrollmentId,
          values,
          session.user.id,
          transaction,
        ),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isRetryableTransactionError(error) && attempt < MAX_TRANSACTION_ATTEMPTS) continue;
      if (error instanceof StudentEnrollmentGradeCorrectionError) throw error;
      if (isRetryableTransactionError(error)) {
        throw new StudentEnrollmentGradeCorrectionError("Enrollment changed concurrently. Refresh and try again.");
      }
      throw new StudentEnrollmentGradeCorrectionError("Controlled Enrollment grade-level correction could not be completed.");
    }
  }
  throw new StudentEnrollmentGradeCorrectionError("Controlled Enrollment grade-level correction could not be completed.");
}
