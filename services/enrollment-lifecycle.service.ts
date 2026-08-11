import { Prisma, type StudentStatus } from "@/app/generated/prisma/client";
import { isAcademicYearWritable } from "@/lib/academic-year";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  findActiveEnrollmentById,
  findLatestActiveEnrollmentByStudent,
  findLatestTerminalEnrollmentByStudent,
  lockAcademicYearForEnrollment,
  updateEnrollment,
} from "@/repositories/enrollment.repository";
import {
  lockStudentForEnrollmentSynchronization,
  updateStudentEnrollmentSummary,
} from "@/repositories/student.repository";
import type { TransitionEnrollmentInput } from "@/schemas";

export class EnrollmentLifecycleError extends Error {}

type AuditChanges = Record<string, { from: string; to: string }>;

function getStudentName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
}) {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ");
}

async function synchronizeStudent(
  studentId: string,
  transaction: Prisma.TransactionClient,
) {
  const activeEnrollment = await findLatestActiveEnrollmentByStudent(
    studentId,
    transaction,
  );
  let status: StudentStatus = "ENROLLED";
  const currentSectionId = activeEnrollment?.sectionId ?? null;

  if (!activeEnrollment) {
    const terminalEnrollment = await findLatestTerminalEnrollmentByStudent(
      studentId,
      transaction,
    );

    if (terminalEnrollment?.status === "TRANSFERRED") status = "TRANSFERRED";
    else if (terminalEnrollment?.status === "DROPPED") status = "DROPPED";
    else if (!terminalEnrollment) status = "UNENROLLED";
  }

  await updateStudentEnrollmentSummary(
    studentId,
    { status, currentSectionId },
    transaction,
  );
  return { status, currentSectionId };
}

export async function transitionEnrollmentInTransaction(
  id: string,
  values: TransitionEnrollmentInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  const enrollmentReference = await findActiveEnrollmentById(id, transaction);
  if (!enrollmentReference) {
    throw new EnrollmentLifecycleError("Enrollment not found.");
  }

  await lockStudentForEnrollmentSynchronization(
    enrollmentReference.studentId,
    transaction,
  );
  const academicYear = await lockAcademicYearForEnrollment(
    enrollmentReference.academicYearId,
    transaction,
  );
  if (!academicYear || !isAcademicYearWritable(academicYear.status)) {
    throw new EnrollmentLifecycleError(
      academicYear?.status === "LOCKED" || academicYear?.status === "ARCHIVED"
        ? "Enrollment is read-only because its academic year is locked or archived."
        : "Enrollment cannot be updated because its academic year is not active.",
    );
  }

  const enrollment = await findActiveEnrollmentById(id, transaction);
  if (!enrollment) throw new EnrollmentLifecycleError("Enrollment not found.");
  if (enrollment.status !== "ACTIVE") {
    throw new EnrollmentLifecycleError(
      `Enrollment status cannot change from ${enrollment.status} to ${values.status}.`,
    );
  }

  const updateResult = await updateEnrollment(
    {
      id: enrollment.id,
      deletedAt: null,
      status: "ACTIVE",
      academicYear: { status: "ACTIVE" },
    },
    { status: values.status },
    transaction,
  );
  if (updateResult.count !== 1) {
    throw new EnrollmentLifecycleError(
      "Enrollment is no longer active and cannot be transitioned.",
    );
  }

  const synchronizedStudent = await synchronizeStudent(
    enrollment.studentId,
    transaction,
  );
  const changes: AuditChanges = {
    status: { from: "ACTIVE", to: values.status },
  };
  if (enrollment.student.status !== synchronizedStudent.status) {
    changes["student.status"] = {
      from: enrollment.student.status,
      to: synchronizedStudent.status,
    };
  }
  if (
    enrollment.student.currentSectionId !==
    synchronizedStudent.currentSectionId
  ) {
    changes["student.currentSectionId"] = {
      from: enrollment.student.currentSectionId ?? "NONE",
      to: synchronizedStudent.currentSectionId ?? "NONE",
    };
  }

  await createAuditLogs(
    [
      {
        userId: actorId,
        action: "UPDATE",
        module: "Enrollment",
        recordId: enrollment.id,
        recordName: `${enrollment.student.lrn} - ${getStudentName(enrollment.student)} - ${enrollment.academicYear.label}`,
        description: `Transitioned enrollment from ACTIVE to ${values.status}.`,
        metadata: { changes },
      },
    ],
    transaction,
  );

  return enrollment.id;
}
