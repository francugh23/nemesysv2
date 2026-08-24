import { randomUUID } from "node:crypto";

import { Prisma } from "@/app/generated/prisma/client";
import { getPhilippineCalendarDate } from "@/lib/academic-term-current";
import { createAuditLogs } from "@/repositories/audit.repository";
import { updateEnrollment } from "@/repositories/enrollment.repository";
import {
  createGradeCorrectionDestinationSse,
  createGradeCorrectionIntent,
  createGradeCorrectionSubjectLink,
  deferGradeCorrectionValidation,
  findGradeCorrectionReference,
  forceGradeCorrectionValidation,
  lockGradeCorrectionAcademicYear,
  lockGradeCorrectionConflicts,
  lockGradeCorrectionDestinationOfferings,
  lockGradeCorrectionEnrollment,
  lockGradeCorrectionSections,
  lockGradeCorrectionSourceEvidence,
  replaceGradeCorrectionSourceSse,
  setGradeCorrectionCapability,
  type LockedGradeCorrectionAcademicYear,
  type LockedGradeCorrectionOffering,
  type LockedGradeCorrectionSse,
} from "@/repositories/student-enrollment-grade-correction.repository";
import { lockStudentForEnrollmentSynchronization } from "@/repositories/student.repository";
import type { CorrectStudentEnrollmentGradePlacementInput } from "@/schemas";
import { synchronizeStudentFromEnrollments } from "@/services/enrollment-synchronization.service";

export class StudentEnrollmentGradeCorrectionError extends Error {}

export const REGULAR_JHS_SUBJECT_PREFIXES = [
  "FIL", "ENG", "MATH", "SCI", "AP", "MAPEH", "TLE", "GMRC",
] as const;

type SubjectCoverage = {
  id: string;
  subjectCode: string;
  subjectDescription: string;
  gradeLevel: string;
  status?: string;
  selectionAcademicTermId?: string | null;
  shsClassification?: string | null;
  termIds: string[];
  resultCount: number;
  offering: {
    academicYearId: string;
    gradeLevel: string;
    subjectCode: string;
    subjectDescription: string;
    shsContextId: string | null;
    termIds: string[];
    termAcademicYearIds: string[];
  };
};

type OfferingCoverage = {
  id: string;
  academicYearId: string;
  gradeLevel: string;
  subjectCode: string;
  subjectDescription: string;
  deletedAt: Date | null;
  replacementSubjectOfferingId: string | null;
  shsContextId: string | null;
  subjectCodeCurrent: string;
  subjectDescriptionCurrent: string;
  subjectGradeLevel: string;
  subjectTrackStrand: string | null;
  subjectDeletedAt: Date | null;
  termIds: string[];
  termAcademicYearIds: string[];
};

function sorted(values: string[]) {
  return [...values].sort();
}

function hasExactValues(actual: string[], expected: string[]) {
  const left = sorted(actual);
  const right = sorted(expected);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function getRegularJhsExpectedCodes(gradeLevel: string) {
  if (!["7", "8", "9", "10"].includes(gradeLevel)) return [];
  return REGULAR_JHS_SUBJECT_PREFIXES.map((prefix) => `${prefix}${gradeLevel}`);
}

export function getGradeCorrectionTypedConfirmationPhrase(sourceGrade: string, destinationGrade: string) {
  return `CHANGE GRADE ${sourceGrade} TO GRADE ${destinationGrade}`;
}

export function gradeCorrectionRequiresTypedConfirmation(
  terms: Array<{ startDate: Date }>,
  now: Date = new Date(),
) {
  const earliest = [...terms].sort((left, right) => left.startDate.getTime() - right.startDate.getTime())[0];
  return Boolean(earliest && getPhilippineCalendarDate(now) >= earliest.startDate.toISOString().slice(0, 10));
}

export function validateRegularJhsGradeCorrection(input: {
  enrollment: {
    status: string;
    deletedAt: Date | null;
    shsTrack: string | null;
    entryAcademicTermId: string | null;
  };
  student: { status: string; currentSectionId: string | null; deletedAt: Date | null };
  academicYear: LockedGradeCorrectionAcademicYear;
  sourceSection: { id: string; gradeLevel: string; trackStrand: string | null; deletedAt: Date | null };
  destinationSection: { id: string; gradeLevel: string; trackStrand: string | null; deletedAt: Date | null };
  sourceSubjects: SubjectCoverage[];
  destinationOfferings: OfferingCoverage[];
}) {
  const blockers: string[] = [];
  const sourceCodes = getRegularJhsExpectedCodes(input.sourceSection.gradeLevel);
  const destinationCodes = getRegularJhsExpectedCodes(input.destinationSection.gradeLevel);
  const termIds = input.academicYear.terms.map(({ id }) => id);

  if (input.enrollment.deletedAt || input.enrollment.status !== "ACTIVE") blockers.push("Only an active Enrollment can have its grade corrected.");
  if (input.academicYear.status !== "ACTIVE") blockers.push("Grade correction is available only in the active Academic Year.");
  if (input.student.deletedAt || input.student.status !== "ENROLLED" || input.student.currentSectionId !== input.sourceSection.id) {
    blockers.push("The active Student placement summary does not match the source Enrollment.");
  }
  if (input.sourceSection.deletedAt || input.sourceSection.trackStrand !== null || !sourceCodes.length) {
    blockers.push("The source must be an active regular JHS Grade 7-10 Section.");
  }
  if (input.destinationSection.deletedAt || input.destinationSection.trackStrand !== null || !destinationCodes.length) {
    blockers.push("The destination must be an active regular JHS Grade 7-10 Section.");
  }
  if (input.sourceSection.id === input.destinationSection.id || input.sourceSection.gradeLevel === input.destinationSection.gradeLevel) {
    blockers.push("Grade-level correction requires a different destination grade and Section.");
  }
  if (input.enrollment.shsTrack !== null || input.enrollment.entryAcademicTermId !== null) {
    blockers.push("Regular JHS grade correction requires null SHS Track and entry Academic Term facts.");
  }

  if (input.sourceSubjects.length) {
    if (input.sourceSubjects.some(({ status }) => status !== "ACTIVE")) {
      blockers.push("Source participation contains REPLACED or DROPPED history and cannot be corrected again.");
    }
    if (input.sourceSubjects.length !== REGULAR_JHS_SUBJECT_PREFIXES.length ||
      !hasExactValues(input.sourceSubjects.map(({ subjectCode }) => subjectCode), sourceCodes)) {
      blockers.push("Source participation must be exactly the eight active source-grade baseline subjects.");
    }
    if (input.sourceSubjects.some(({ gradeLevel }) => gradeLevel !== input.sourceSection.gradeLevel)) {
      blockers.push("Source participation contains a subject snapshot from another grade.");
    }
    if (input.sourceSubjects.some(({ selectionAcademicTermId, shsClassification }) =>
      selectionAcademicTermId !== null || shsClassification !== null)) {
      blockers.push("Source participation contains SHS or Term-selection context.");
    }
    if (input.sourceSubjects.some(({ termIds: coveredTerms }) => !hasExactValues(coveredTerms, termIds))) {
      blockers.push("Every source baseline subject must cover every configured Academic Term.");
    }
    if (input.sourceSubjects.some((subject) =>
      subject.offering.academicYearId !== input.academicYear.id ||
      subject.offering.gradeLevel !== input.sourceSection.gradeLevel ||
      subject.offering.subjectCode !== subject.subjectCode ||
      subject.offering.subjectDescription !== subject.subjectDescription ||
      subject.offering.shsContextId !== null ||
      !hasExactValues(subject.offering.termIds, termIds) ||
      !hasExactValues(subject.offering.termIds, subject.termIds) ||
      subject.offering.termAcademicYearIds.some((academicYearId) => academicYearId !== input.academicYear.id))) {
      blockers.push("A source participation row does not match its immutable regular JHS Offering and exact Academic Term evidence.");
    }
  }

  if (input.sourceSubjects.some(({ resultCount }) => resultCount > 0)) {
    blockers.push("Attached results block grade-level correction.");
  }

  if (input.destinationOfferings.length !== REGULAR_JHS_SUBJECT_PREFIXES.length ||
    !hasExactValues(input.destinationOfferings.map(({ subjectCode }) => subjectCode), destinationCodes)) {
    blockers.push("The destination Curriculum must contain exactly the eight active destination-grade baseline Offerings without duplicates.");
  }
  if (input.destinationOfferings.some((offering) =>
    offering.academicYearId !== input.academicYear.id ||
    offering.gradeLevel !== input.destinationSection.gradeLevel ||
    offering.subjectGradeLevel !== input.destinationSection.gradeLevel ||
    offering.subjectTrackStrand !== null ||
    offering.subjectDeletedAt !== null ||
    offering.deletedAt !== null ||
    offering.shsContextId !== null ||
    offering.replacementSubjectOfferingId !== null ||
    offering.subjectCodeCurrent !== offering.subjectCode ||
    offering.subjectDescriptionCurrent !== offering.subjectDescription)) {
    blockers.push("A destination Offering has malformed year, grade, Subject, SHS context, snapshot, or active replacement lineage.");
  }
  if (input.destinationOfferings.some((offering) =>
    !hasExactValues(offering.termIds, termIds) ||
    offering.termAcademicYearIds.some((academicYearId) => academicYearId !== input.academicYear.id))) {
    blockers.push("Every destination baseline Offering must cover exactly every configured Academic Term.");
  }

  return [...new Set(blockers)];
}

function sourceCoverage(rows: LockedGradeCorrectionSse[]): SubjectCoverage[] {
  return rows.map((row) => ({
    id: row.id,
    subjectCode: row.subjectCode,
    subjectDescription: row.subjectDescription,
    gradeLevel: row.gradeLevel,
    status: row.status,
    selectionAcademicTermId: row.selectionAcademicTermId,
    shsClassification: row.shsClassification,
    termIds: row.terms.map(({ academicTermId }) => academicTermId),
    resultCount: row.terms.filter(({ resultId }) => resultId !== null).length,
    offering: {
      academicYearId: row.offering.academicYearId,
      gradeLevel: row.offering.gradeLevel,
      subjectCode: row.offering.subjectCode,
      subjectDescription: row.offering.subjectDescription,
      shsContextId: row.offering.shsContextId,
      termIds: row.offering.terms.map(({ academicTermId }) => academicTermId),
      termAcademicYearIds: row.offering.terms.map(({ academicYearId }) => academicYearId),
    },
  }));
}

function offeringCoverage(rows: LockedGradeCorrectionOffering[]): OfferingCoverage[] {
  return rows.map((row) => ({
    ...row,
    termIds: row.terms.map(({ academicTermId }) => academicTermId),
    termAcademicYearIds: row.terms.map(({ academicYearId }) => academicYearId),
  }));
}

function canonicalPrefix(subjectCode: string, gradeLevel: string) {
  const prefix = subjectCode.slice(0, -gradeLevel.length);
  if (!(REGULAR_JHS_SUBJECT_PREFIXES as readonly string[]).includes(prefix)) {
    throw new StudentEnrollmentGradeCorrectionError("A baseline subject has an invalid canonical prefix.");
  }
  return prefix;
}

export async function correctStudentEnrollmentGradePlacementInTransaction(
  enrollmentId: string,
  values: CorrectStudentEnrollmentGradePlacementInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
  clock: () => Date = () => new Date(),
  correctionId: string = randomUUID(),
) {
  if (!values.confirmed) throw new StudentEnrollmentGradeCorrectionError("Confirm the permanent grade-level correction before continuing.");
  const reference = await findGradeCorrectionReference(enrollmentId, transaction);
  if (!reference) throw new StudentEnrollmentGradeCorrectionError("Enrollment not found.");

  // Lock order is part of the database capability contract.
  const [student] = await lockStudentForEnrollmentSynchronization(reference.studentId, transaction);
  if (!student) throw new StudentEnrollmentGradeCorrectionError("Student not found.");
  const enrollment = await lockGradeCorrectionEnrollment(enrollmentId, transaction);
  if (!enrollment || enrollment.studentId !== reference.studentId) throw new StudentEnrollmentGradeCorrectionError("Enrollment changed. Refresh and try again.");
  const academicYear = await lockGradeCorrectionAcademicYear(enrollment.academicYearId, transaction);
  if (!academicYear) throw new StudentEnrollmentGradeCorrectionError("Academic Year not found.");
  const sections = await lockGradeCorrectionSections(
    [enrollment.sectionId, values.sourceSectionId, values.destinationSectionId],
    transaction,
  );
  await lockGradeCorrectionConflicts(enrollment.id, transaction);
  const sourceSubjects = await lockGradeCorrectionSourceEvidence(enrollment.id, transaction);

  const sourceSection = sections.find(({ id }) => id === enrollment.sectionId);
  const destinationSection = sections.find(({ id }) => id === values.destinationSectionId);
  if (!sourceSection || !destinationSection || enrollment.sectionId !== values.sourceSectionId) {
    throw new StudentEnrollmentGradeCorrectionError("Enrollment placement changed. Refresh and try again.");
  }
  const expectedDestinationCodes = getRegularJhsExpectedCodes(destinationSection.gradeLevel);
  if (!expectedDestinationCodes.length) {
    throw new StudentEnrollmentGradeCorrectionError("The destination must be an active regular JHS Grade 7-10 Section.");
  }
  const destinationOfferings = await lockGradeCorrectionDestinationOfferings(
    enrollment.academicYearId,
    expectedDestinationCodes,
    transaction,
  );
  const blockers = validateRegularJhsGradeCorrection({
    enrollment,
    student,
    academicYear,
    sourceSection,
    destinationSection,
    sourceSubjects: sourceCoverage(sourceSubjects),
    destinationOfferings: offeringCoverage(destinationOfferings),
  });
  if (blockers.length) throw new StudentEnrollmentGradeCorrectionError(blockers[0]);

  const correctedAt = clock();
  const phrase = getGradeCorrectionTypedConfirmationPhrase(sourceSection.gradeLevel, destinationSection.gradeLevel);
  if (gradeCorrectionRequiresTypedConfirmation(academicYear.terms, correctedAt) && values.typedConfirmation !== phrase) {
    throw new StudentEnrollmentGradeCorrectionError(`Type ${phrase} exactly to confirm this grade-level correction.`);
  }

  const sourcePlacementSnapshot = {
    enrollmentId: enrollment.id,
    studentId: enrollment.studentId,
    academicYearId: enrollment.academicYearId,
    enrollmentStatus: enrollment.status,
    entryAcademicTermId: enrollment.entryAcademicTermId,
    shsTrack: enrollment.shsTrack,
    semester: enrollment.semester,
    createdById: enrollment.createdById,
    sectionId: sourceSection.id,
    gradeLevel: sourceSection.gradeLevel,
    trackStrand: sourceSection.trackStrand,
    sectionName: sourceSection.sectionName,
  };
  const destinationPlacementSnapshot = {
    ...sourcePlacementSnapshot,
    sectionId: destinationSection.id,
    gradeLevel: destinationSection.gradeLevel,
    trackStrand: destinationSection.trackStrand,
    sectionName: destinationSection.sectionName,
  };

  await deferGradeCorrectionValidation(transaction);
  await setGradeCorrectionCapability(correctionId, transaction);
  await createGradeCorrectionIntent({
    id: correctionId,
    enrollmentId: enrollment.id,
    sourceSectionId: sourceSection.id,
    destinationSectionId: destinationSection.id,
    sourcePlacementSnapshot,
    destinationPlacementSnapshot,
    enrollmentCreatedAtSnapshot: enrollment.createdAt,
    sourceParticipationCount: sourceSubjects.length,
    replacementParticipationCount: REGULAR_JHS_SUBJECT_PREFIXES.length,
    reason: values.reason,
    evidenceReference: values.evidenceReference,
    correctedById: actorId,
    correctedAt,
  }, transaction);

  const createdByPrefix = new Map<string, Awaited<ReturnType<typeof createGradeCorrectionDestinationSse>>>();
  for (const offering of destinationOfferings) {
    const created = await createGradeCorrectionDestinationSse(enrollment.id, offering, actorId, transaction);
    createdByPrefix.set(canonicalPrefix(offering.subjectCode, destinationSection.gradeLevel), created);
  }
  const sourceByPrefix = new Map(sourceSubjects.map((row) => [canonicalPrefix(row.subjectCode, sourceSection.gradeLevel), row]));
  for (const prefix of sourceSubjects.length ? REGULAR_JHS_SUBJECT_PREFIXES : []) {
    const source = sourceByPrefix.get(prefix);
    const destination = createdByPrefix.get(prefix);
    const offering = destinationOfferings.find((row) =>
      canonicalPrefix(row.subjectCode, destinationSection.gradeLevel) === prefix);
    if (!source || !destination || !offering) throw new StudentEnrollmentGradeCorrectionError("Destination baseline materialization is incomplete.");
    await createGradeCorrectionSubjectLink({
      id: randomUUID(),
      correctionId,
      canonicalSubjectPrefix: prefix,
      sourceStudentSubjectEnrollmentId: source.id,
      replacementStudentSubjectEnrollmentId: destination.id,
      sourceParticipationSnapshot: {
        id: source.id,
        subjectOfferingId: source.subjectOfferingId,
        subjectCode: source.subjectCode,
        subjectDescription: source.subjectDescription,
        gradeLevel: source.gradeLevel,
        academicTermIds: source.terms.map(({ academicTermId }) => academicTermId),
        status: "ACTIVE",
      },
      replacementParticipationSnapshot: {
        id: destination.id,
        subjectOfferingId: offering.id,
        subjectCode: offering.subjectCode,
        subjectDescription: offering.subjectDescription,
        gradeLevel: offering.gradeLevel,
        academicTermIds: offering.terms.map(({ academicTermId }) => academicTermId),
        status: "ACTIVE",
      },
    }, transaction);
  }

  for (const sourceSubject of sourceSubjects) {
    const updated = await replaceGradeCorrectionSourceSse(sourceSubject.id, correctedAt, transaction);
    if (updated.count !== 1) throw new StudentEnrollmentGradeCorrectionError("Source participation changed. Refresh and try again.");
  }

  const updated = await updateEnrollment({
    id: enrollment.id,
    sectionId: sourceSection.id,
    status: "ACTIVE",
    deletedAt: null,
    academicYear: { status: "ACTIVE" },
  }, { sectionId: destinationSection.id }, transaction);
  if (updated.count !== 1) throw new StudentEnrollmentGradeCorrectionError("Enrollment placement changed. Refresh and try again.");
  await synchronizeStudentFromEnrollments(enrollment.studentId, transaction);

  const recordName = `${enrollment.id} - ${academicYear.label}`;
  const metadata = {
    correctionId,
    sourceSectionId: sourceSection.id,
    destinationSectionId: destinationSection.id,
    sourceGradeLevel: sourceSection.gradeLevel,
    destinationGradeLevel: destinationSection.gradeLevel,
    sourceStudentSubjectEnrollmentIds: sourceSubjects.map(({ id }) => id),
    destinationStudentSubjectEnrollmentIds: [...createdByPrefix.values()].map(({ id }) => id),
    reason: values.reason,
    evidenceReference: values.evidenceReference,
  };
  await createAuditLogs([
    {
      userId: actorId,
      action: "CREATE",
      module: "StudentEnrollmentGradeCorrection",
      recordId: correctionId,
      recordName,
      description: "Recorded a controlled regular JHS Enrollment grade-level correction.",
      metadata,
    },
    {
      userId: actorId,
      action: "UPDATE",
      module: "Enrollment",
      recordId: enrollment.id,
      recordName,
      description: "Corrected Enrollment grade and Section with replacement participation history.",
      metadata,
    },
    ...sourceSubjects.map((row) => ({
      userId: actorId,
      action: "UPDATE",
      module: "StudentSubjectEnrollment",
      recordId: row.id,
      recordName: `${recordName} - ${row.subjectCode}`,
      description: "Replaced source-grade participation through controlled Enrollment grade correction.",
      metadata: { ...metadata, status: { from: "ACTIVE", to: "REPLACED" }, subjectCode: row.subjectCode },
    })),
    ...[...createdByPrefix.values()].map((row) => ({
      userId: actorId,
      action: "CREATE",
      module: "StudentSubjectEnrollment",
      recordId: row.id,
      recordName: `${recordName} - ${row.subjectCode}`,
      description: "Created destination-grade baseline participation through controlled Enrollment grade correction.",
      metadata: { ...metadata, subjectOfferingId: row.subjectOfferingId, subjectCode: row.subjectCode },
    })),
  ], transaction);

  await forceGradeCorrectionValidation(transaction);
  await deferGradeCorrectionValidation(transaction);
  return { correctionId, enrollmentId: enrollment.id };
}
