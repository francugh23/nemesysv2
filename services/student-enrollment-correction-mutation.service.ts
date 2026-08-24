import { randomUUID } from "node:crypto";

import { Prisma } from "@/app/generated/prisma/client";
import { createAuditLogs } from "@/repositories/audit.repository";
import { findActiveEnrollmentById, updateEnrollment } from "@/repositories/enrollment.repository";
import {
  createStudentEnrollmentCorrection,
  countStudentEnrollmentCorrectionParticipationImpact,
  deferStudentEnrollmentCorrectionValidation,
  findStudentEnrollmentCorrectionReference,
  forceStudentEnrollmentCorrectionValidation,
  lockAcademicYearForStudentCorrection,
  lockEnrollmentForStudentCorrection,
  lockSectionsForStudentCorrection,
  lockStudentCorrectionConflicts,
  setStudentEnrollmentCorrectionContext,
} from "@/repositories/student-enrollment-correction.repository";
import { lockStudentForEnrollmentSynchronization } from "@/repositories/student.repository";
import type { CorrectStudentEnrollmentPlacementInput } from "@/schemas";
import { synchronizeStudentFromEnrollments } from "@/services/enrollment-synchronization.service";

export class StudentEnrollmentCorrectionError extends Error {}

type SectionPlacementSnapshot = {
  sectionId: string;
  gradeLevel: string;
  trackStrand: string | null;
  sectionName: string;
};

type PlacementSnapshot = SectionPlacementSnapshot & {
  enrollmentId: string;
  studentId: string;
  academicYearId: string;
  enrollmentStatus: string;
  entryAcademicTermId: string | null;
  shsTrack: string | null;
  semester: string | null;
  createdById: string;
};

export function placementSectionLabel(snapshot: SectionPlacementSnapshot) {
  return `Grade ${snapshot.gradeLevel}${snapshot.trackStrand ? ` - ${snapshot.trackStrand}` : ""} - ${snapshot.sectionName}`;
}

function personName(person: { firstName: string; middleName: string | null; lastName: string }) {
  return [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ");
}

export async function correctStudentEnrollmentPlacementInTransaction(
  enrollmentId: string,
  values: CorrectStudentEnrollmentPlacementInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
  clock: () => Date = () => new Date(),
  correctionId: string = randomUUID(),
) {
  if (!values.confirmed) {
    throw new StudentEnrollmentCorrectionError("Confirm the historical placement correction before continuing.");
  }
  const reference = await findStudentEnrollmentCorrectionReference(enrollmentId, transaction);
  if (!reference) throw new StudentEnrollmentCorrectionError("Enrollment not found.");

  const [student] = await lockStudentForEnrollmentSynchronization(reference.studentId, transaction);
  if (!student || student.deletedAt) {
    throw new StudentEnrollmentCorrectionError("Student not found.");
  }
  const enrollment = await lockEnrollmentForStudentCorrection(enrollmentId, transaction);
  if (!enrollment || enrollment.studentId !== reference.studentId) {
    throw new StudentEnrollmentCorrectionError("Enrollment changed. Refresh and try again.");
  }
  const academicYear = await lockAcademicYearForStudentCorrection(enrollment.academicYearId, transaction);
  const sections = await lockSectionsForStudentCorrection(
    [enrollment.sectionId, values.sourceSectionId, values.destinationSectionId],
    transaction,
  );
  await lockStudentCorrectionConflicts(enrollment.id, transaction);

  if (enrollment.deletedAt || enrollment.status !== "ACTIVE") {
    throw new StudentEnrollmentCorrectionError("Only an active Enrollment can have its placement corrected.");
  }
  if (!academicYear || academicYear.status !== "ACTIVE") {
    throw new StudentEnrollmentCorrectionError("Enrollment placement can be corrected only in an active Academic Year.");
  }
  if (student.status !== "ENROLLED" || student.currentSectionId !== enrollment.sectionId) {
    throw new StudentEnrollmentCorrectionError("Student placement summary does not match the active Enrollment.");
  }
  if (enrollment.sectionId !== values.sourceSectionId) {
    throw new StudentEnrollmentCorrectionError("Enrollment source placement changed. Refresh and try again.");
  }
  if (enrollment.sectionId === values.destinationSectionId) {
    throw new StudentEnrollmentCorrectionError("Select a different destination Section.");
  }
  const source = sections.find(({ id }) => id === enrollment.sectionId);
  const destination = sections.find(({ id }) => id === values.destinationSectionId);
  if (!source || source.deletedAt) {
    throw new StudentEnrollmentCorrectionError("Current Enrollment Section no longer exists or is inactive.");
  }
  if (!destination || destination.deletedAt) {
    throw new StudentEnrollmentCorrectionError("Destination Section not found or inactive.");
  }
  if (source.gradeLevel !== destination.gradeLevel) {
    throw new StudentEnrollmentCorrectionError("Placement correction cannot change the student's grade level.");
  }

  const lockedDetail = await findActiveEnrollmentById(enrollment.id, transaction);
  if (!lockedDetail || lockedDetail.sectionId !== source.id) {
    throw new StudentEnrollmentCorrectionError("Enrollment source placement changed. Refresh and try again.");
  }
  const participationCount = await countStudentEnrollmentCorrectionParticipationImpact(
    enrollment.id,
    transaction,
  );
  const sourceSnapshot: PlacementSnapshot = {
    enrollmentId: enrollment.id,
    studentId: enrollment.studentId,
    academicYearId: enrollment.academicYearId,
    enrollmentStatus: enrollment.status,
    entryAcademicTermId: enrollment.entryAcademicTermId,
    shsTrack: enrollment.shsTrack,
    semester: lockedDetail.semester,
    createdById: lockedDetail.createdById,
    sectionId: source.id,
    gradeLevel: source.gradeLevel,
    trackStrand: source.trackStrand,
    sectionName: source.sectionName,
  };
  const destinationSnapshot: PlacementSnapshot = {
    ...sourceSnapshot,
    sectionId: destination.id,
    gradeLevel: destination.gradeLevel,
    trackStrand: destination.trackStrand,
    sectionName: destination.sectionName,
  };
  const correctedAt = clock();

  await deferStudentEnrollmentCorrectionValidation(transaction);
  await createStudentEnrollmentCorrection({
    id: correctionId,
    enrollmentId: enrollment.id,
    sourceSectionId: source.id,
    destinationSectionId: destination.id,
    sourcePlacementSnapshot: sourceSnapshot,
    destinationPlacementSnapshot: destinationSnapshot,
    enrollmentCreatedAtSnapshot: lockedDetail.createdAt,
    reason: values.reason,
    evidenceReference: values.evidenceReference,
    correctedById: actorId,
    correctedAt,
    createdAt: correctedAt,
  }, transaction);
  await setStudentEnrollmentCorrectionContext(correctionId, transaction);

  const updated = await updateEnrollment({
    id: enrollment.id,
    sectionId: source.id,
    status: "ACTIVE",
    deletedAt: null,
    academicYear: { status: "ACTIVE" },
  }, { sectionId: destination.id }, transaction);
  if (updated.count !== 1) {
    throw new StudentEnrollmentCorrectionError("Enrollment source placement changed. Refresh and try again.");
  }

  await synchronizeStudentFromEnrollments(enrollment.studentId, transaction);
  const recordName = `${lockedDetail.student.lrn} - ${personName(lockedDetail.student)} - ${academicYear.label}`;
  const metadata = {
    correctionId,
    sourceSectionId: source.id,
    destinationSectionId: destination.id,
    gradeLevel: source.gradeLevel,
    participationCount,
    reason: values.reason,
    evidenceReference: values.evidenceReference,
    participationChanged: false,
    resultsChanged: false,
  };
  await createAuditLogs([
    {
      userId: actorId,
      action: "CREATE",
      module: "StudentEnrollmentCorrection",
      recordId: correctionId,
      recordName,
      description: "Recorded an immutable same-grade Enrollment placement correction.",
      metadata,
    },
    {
      userId: actorId,
      action: "UPDATE",
      module: "Enrollment",
      recordId: enrollment.id,
      recordName,
      description: "Corrected Enrollment placement without changing grade or participation history.",
      metadata: {
        ...metadata,
        changes: {
          section: { from: placementSectionLabel(sourceSnapshot), to: placementSectionLabel(destinationSnapshot) },
          "student.currentSectionId": { from: source.id, to: destination.id },
        },
      },
    },
  ], transaction);
  await forceStudentEnrollmentCorrectionValidation(transaction);
  await deferStudentEnrollmentCorrectionValidation(transaction);

  return { correctionId, enrollmentId: enrollment.id };
}
