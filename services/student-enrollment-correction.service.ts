import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import {
  findSameGradePlacementDestinations,
  findStudentEnrollmentCorrectionContext,
} from "@/repositories/student-enrollment-correction.repository";
import type {
  CorrectStudentEnrollmentPlacementInput,
  StudentEnrollmentCorrectionContext,
} from "@/schemas";
import {
  correctStudentEnrollmentPlacementInTransaction,
  placementSectionLabel,
  StudentEnrollmentCorrectionError,
} from "@/services/student-enrollment-correction-mutation.service";

export { StudentEnrollmentCorrectionError } from "@/services/student-enrollment-correction-mutation.service";

const MAX_TRANSACTION_ATTEMPTS = 3;

type PlacementSnapshot = {
  enrollmentId: string;
  studentId: string;
  academicYearId: string;
  enrollmentStatus: string;
  entryAcademicTermId: string | null;
  shsTrack: string | null;
  semester: string | null;
  createdById: string;
  sectionId: string;
  gradeLevel: string;
  trackStrand: string | null;
  sectionName: string;
};

function actorName(actor: { firstName: string; middleName: string | null; lastName: string }) {
  return [actor.firstName, actor.middleName, actor.lastName].filter(Boolean).join(" ");
}

function parseSnapshot(value: Prisma.JsonValue): PlacementSnapshot {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new StudentEnrollmentCorrectionError("Stored placement correction snapshot is invalid.");
  }
  const snapshot = value as Record<string, Prisma.JsonValue>;
  if (
    typeof snapshot.sectionId !== "string" ||
    typeof snapshot.enrollmentId !== "string" ||
    typeof snapshot.studentId !== "string" ||
    typeof snapshot.academicYearId !== "string" ||
    typeof snapshot.enrollmentStatus !== "string" ||
    (snapshot.entryAcademicTermId !== null && typeof snapshot.entryAcademicTermId !== "string") ||
    (snapshot.shsTrack !== null && typeof snapshot.shsTrack !== "string") ||
    (snapshot.semester !== null && typeof snapshot.semester !== "string") ||
    typeof snapshot.createdById !== "string" ||
    typeof snapshot.gradeLevel !== "string" ||
    typeof snapshot.sectionName !== "string" ||
    (snapshot.trackStrand !== null && typeof snapshot.trackStrand !== "string")
  ) {
    throw new StudentEnrollmentCorrectionError("Stored placement correction snapshot is invalid.");
  }
  return snapshot as PlacementSnapshot;
}

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; meta?: { code?: unknown }; cause?: unknown };
  return candidate.code === "40001" || candidate.code === "40P01" ||
    candidate.meta?.code === "40001" || candidate.meta?.code === "40P01" ||
    isRetryableTransactionError(candidate.cause);
}

export async function getStudentEnrollmentCorrectionContextService(
  enrollmentId: string,
): Promise<StudentEnrollmentCorrectionContext> {
  await requirePermission(Permissions.STUDENT_CORRECTIONS);
  const enrollment = await findStudentEnrollmentCorrectionContext(enrollmentId);
  if (!enrollment) throw new StudentEnrollmentCorrectionError("Enrollment not found.");
  const destinations = await findSameGradePlacementDestinations(
    enrollment.section.gradeLevel,
    enrollment.sectionId,
  );
  return {
    enrollmentId: enrollment.id,
    gradeLevel: enrollment.section.gradeLevel,
    currentSectionId: enrollment.sectionId,
    currentSection: placementSectionLabel({ sectionId: enrollment.sectionId, ...enrollment.section }),
    participationCount: enrollment._count.studentSubjectEnrollments,
    destinations,
    history: enrollment.placementCorrections.map((correction) => ({
      id: correction.id,
      sourceSection: placementSectionLabel(parseSnapshot(correction.sourcePlacementSnapshot)),
      destinationSection: placementSectionLabel(parseSnapshot(correction.destinationPlacementSnapshot)),
      correctedBy: actorName(correction.correctedBy),
      correctedAt: correction.correctedAt,
      reason: correction.reason,
      evidenceReference: correction.evidenceReference,
    })),
  };
}

export async function correctStudentEnrollmentPlacementService(
  enrollmentId: string,
  values: CorrectStudentEnrollmentPlacementInput,
) {
  const session = await requirePermission(Permissions.STUDENT_CORRECTIONS);
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(
        (transaction) => correctStudentEnrollmentPlacementInTransaction(
          enrollmentId,
          values,
          session.user.id,
          transaction,
        ),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isRetryableTransactionError(error) && attempt < MAX_TRANSACTION_ATTEMPTS) continue;
      if (error instanceof StudentEnrollmentCorrectionError) throw error;
      if (isRetryableTransactionError(error)) {
        throw new StudentEnrollmentCorrectionError("Enrollment changed concurrently. Refresh and try again.");
      }
      throw new StudentEnrollmentCorrectionError("Controlled Enrollment placement correction could not be completed.");
    }
  }
  throw new StudentEnrollmentCorrectionError("Controlled Enrollment placement correction could not be completed.");
}
