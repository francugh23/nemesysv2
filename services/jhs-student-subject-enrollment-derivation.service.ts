import { Prisma } from "@/app/generated/prisma/client";
import { createAuditLogs } from "@/repositories/audit.repository";
import { findApprovedRegularJhsOfferings } from "@/repositories/subject-offering.repository";
import {
  createStudentSubjectEnrollmentsFromOfferings,
  replaceActiveStudentSubjectEnrollments,
} from "@/repositories/student-subject-enrollment.repository";

const approvedRegularJhsSubjectPrefixes = [
  "FIL", "ENG", "MATH", "SCI", "AP", "MAPEH", "TLE", "GMRC",
] as const;

function getApprovedRegularJhsSubjectCodes(gradeLevel: string) {
  if (!["7", "8", "9", "10"].includes(gradeLevel)) return [];
  return approvedRegularJhsSubjectPrefixes.map((prefix) => `${prefix}${gradeLevel}`);
}

export function getApprovedRegularJhsEligibilityContext(
  gradeLevel: string,
  trackStrand: string | null,
) {
  return {
    gradeLevel,
    isApprovedRegularJhs: trackStrand === null && getApprovedRegularJhsSubjectCodes(gradeLevel).length > 0,
  };
}

function hasSameApprovedRegularJhsEligibilityContext(
  previous: ReturnType<typeof getApprovedRegularJhsEligibilityContext>,
  next: ReturnType<typeof getApprovedRegularJhsEligibilityContext>,
) {
  return (
    previous.gradeLevel === next.gradeLevel &&
    previous.isApprovedRegularJhs === next.isApprovedRegularJhs
  );
}

export async function deriveApprovedRegularJhsStudentSubjectEnrollments(
  input: {
    enrollmentId: string;
    academicYearId: string;
    academicYearLabel: string;
    gradeLevel: string;
    trackStrand: string | null;
    studentLrn: string;
    actorId: string;
  },
  transaction: Prisma.TransactionClient,
) {
  const subjectCodes = getApprovedRegularJhsEligibilityContext(
    input.gradeLevel,
    input.trackStrand,
  ).isApprovedRegularJhs
    ? getApprovedRegularJhsSubjectCodes(input.gradeLevel)
    : [];
  if (!subjectCodes.length) return [];

  const offerings = await findApprovedRegularJhsOfferings(
    input.academicYearId,
    input.gradeLevel,
    subjectCodes,
    transaction,
  );
  const studentSubjectEnrollments = await createStudentSubjectEnrollmentsFromOfferings(
    input.enrollmentId,
    offerings,
    input.actorId,
    transaction,
  );
  if (!studentSubjectEnrollments.length) return [];

  await createAuditLogs(
    studentSubjectEnrollments.map((studentSubjectEnrollment) => ({
      userId: input.actorId,
      action: "CREATE",
      module: "StudentSubjectEnrollment",
      recordId: studentSubjectEnrollment.id,
      recordName: `${input.studentLrn} - ${studentSubjectEnrollment.subjectCode} - ${input.academicYearLabel}`,
      description: "Created JHS student subject enrollment from approved regular offering.",
      metadata: {
        subjectOfferingId: studentSubjectEnrollment.subjectOfferingId,
        subjectCode: studentSubjectEnrollment.subjectCode,
        subjectDescription: studentSubjectEnrollment.subjectDescription,
        gradeLevel: studentSubjectEnrollment.gradeLevel,
        academicTermIds: studentSubjectEnrollment.terms.map(
          ({ academicTermId }) => academicTermId,
        ),
      },
    })),
    transaction,
  );

  return studentSubjectEnrollments;
}

export async function reconcileApprovedRegularJhsStudentSubjectEnrollments(
  input: {
    enrollmentId: string;
    academicYearId: string;
    academicYearLabel: string;
    enrollmentStatus: "ACTIVE" | "COMPLETED" | "DROPPED" | "TRANSFERRED";
    previousSection: { gradeLevel: string; trackStrand: string | null };
    nextSection: { gradeLevel: string; trackStrand: string | null };
    studentLrn: string;
    actorId: string;
  },
  transaction: Prisma.TransactionClient,
) {
  if (input.enrollmentStatus !== "ACTIVE") {
    return { replaced: [], created: [] };
  }

  const previousContext = getApprovedRegularJhsEligibilityContext(
    input.previousSection.gradeLevel,
    input.previousSection.trackStrand,
  );
  const nextContext = getApprovedRegularJhsEligibilityContext(
    input.nextSection.gradeLevel,
    input.nextSection.trackStrand,
  );

  if (hasSameApprovedRegularJhsEligibilityContext(previousContext, nextContext)) {
    return { replaced: [], created: [] };
  }

  const replaced = await replaceActiveStudentSubjectEnrollments(
    input.enrollmentId,
    new Date(),
    transaction,
  );

  if (replaced.length) {
    await createAuditLogs(
      replaced.map((studentSubjectEnrollment) => ({
        userId: input.actorId,
        action: "UPDATE",
        module: "StudentSubjectEnrollment",
        recordId: studentSubjectEnrollment.id,
        recordName: `${input.studentLrn} - ${studentSubjectEnrollment.subjectCode} - ${input.academicYearLabel}`,
        description: "Replaced student subject enrollment after enrollment section correction.",
        metadata: {
          status: { from: "ACTIVE", to: "REPLACED" },
          subjectOfferingId: studentSubjectEnrollment.subjectOfferingId,
          subjectCode: studentSubjectEnrollment.subjectCode,
          subjectDescription: studentSubjectEnrollment.subjectDescription,
          gradeLevel: studentSubjectEnrollment.gradeLevel,
          academicTermIds: studentSubjectEnrollment.terms.map(
            ({ academicTermId }) => academicTermId,
          ),
        },
      })),
      transaction,
    );
  }

  const created = await deriveApprovedRegularJhsStudentSubjectEnrollments(
    {
      enrollmentId: input.enrollmentId,
      academicYearId: input.academicYearId,
      academicYearLabel: input.academicYearLabel,
      gradeLevel: input.nextSection.gradeLevel,
      trackStrand: input.nextSection.trackStrand,
      studentLrn: input.studentLrn,
      actorId: input.actorId,
    },
    transaction,
  );

  return { replaced, created };
}
