import { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createEnrollment,
  findEnrollmentByIdentity,
  findNonArchivedEnrollments,
} from "@/repositories/enrollment.repository";
import {
  findActiveSectionForAssignment,
  findActiveSectionsForAssignment,
} from "@/repositories/section.repository";
import {
  findActiveStudentForEnrollment,
  findActiveStudentsForEnrollment,
} from "@/repositories/student.repository";
import type { CreateEnrollmentInput, EnrollmentListItem } from "@/schemas";

export class EnrollmentServiceError extends Error {}

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized.");
  }

  return session;
}

export async function getEnrollments(): Promise<EnrollmentListItem[]> {
  await requireSuperAdmin();

  const enrollments = await findNonArchivedEnrollments();

  return enrollments.map((enrollment) => ({
    id: enrollment.id,
    studentId: enrollment.studentId,
    sectionId: enrollment.sectionId,
    studentLrn: enrollment.student.lrn,
    studentFirstName: enrollment.student.firstName,
    studentMiddleName: enrollment.student.middleName,
    studentLastName: enrollment.student.lastName,
    sectionGradeLevel: enrollment.section.gradeLevel,
    sectionTrackStrand: enrollment.section.trackStrand,
    sectionName: enrollment.section.sectionName,
    academicYear: enrollment.academicYear,
    semester: enrollment.semester,
    status: enrollment.status,
  }));
}

export async function getEnrollmentFormOptions() {
  await requireSuperAdmin();

  const [students, sections] = await Promise.all([
    findActiveStudentsForEnrollment(),
    findActiveSectionsForAssignment(),
  ]);

  return {
    students,
    sections,
  };
}

function rethrowEnrollmentConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new EnrollmentServiceError(
      "An enrollment already exists for this student and academic year.",
    );
  }

  throw error;
}

function getStudentName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
}) {
  return [student.firstName, student.middleName, student.lastName]
    .filter(Boolean)
    .join(" ");
}

export async function createEnrollmentService(values: CreateEnrollmentInput) {
  const session = await requireSuperAdmin();
  const academicYear = values.academicYear.trim();

  try {
    return await prisma.$transaction(async (transaction) => {
      const [student, section] = await Promise.all([
        findActiveStudentForEnrollment(values.studentId, transaction),
        findActiveSectionForAssignment(values.sectionId, transaction),
      ]);

      if (!student) {
        throw new EnrollmentServiceError("Student not found or inactive.");
      }

      if (!section) {
        throw new EnrollmentServiceError("Section not found or inactive.");
      }

      const duplicate = await findEnrollmentByIdentity(
        {
          studentId: student.id,
          academicYear,
        },
        transaction,
      );

      if (duplicate) {
        throw new EnrollmentServiceError(
          "An enrollment already exists for this student and academic year.",
        );
      }

      const enrollment = await createEnrollment(
        {
          studentId: student.id,
          sectionId: section.id,
          academicYear,
          semester: values.semester ?? null,
          createdById: session.user.id,
        },
        transaction,
      );

      await createAuditLogs(
        [
          {
            userId: session.user.id,
            action: "CREATE",
            module: "Enrollment",
            recordId: enrollment.id,
            recordName: `${student.lrn} - ${getStudentName(student)} - ${academicYear}`,
            description: `Created enrollment in ${section.sectionName}`,
          },
        ],
        transaction,
      );

      return enrollment;
    });
  } catch (error) {
    rethrowEnrollmentConflict(error);
  }
}
