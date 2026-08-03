import { Prisma, type StudentStatus } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createEnrollment,
  findActiveEnrollmentById,
  findEnrollmentByIdentity,
  findLatestActiveEnrollmentByStudent,
  findLatestTerminalEnrollmentByStudent,
  findNonArchivedEnrollments,
  updateEnrollment,
} from "@/repositories/enrollment.repository";
import {
  findActiveSectionForAssignment,
  findActiveSectionsForAssignment,
} from "@/repositories/section.repository";
import {
  findActiveStudentForEnrollment,
  findActiveStudentsForEnrollment,
  lockStudentForEnrollmentSynchronization,
  updateStudentEnrollmentSummary,
} from "@/repositories/student.repository";
import type {
  CreateEnrollmentInput,
  EnrollmentListItem,
  UpdateEnrollmentInput,
} from "@/schemas";

export class EnrollmentServiceError extends Error {}

type EnrollmentStatus = UpdateEnrollmentInput["status"];
type AuditChanges = Record<string, { from: string; to: string }>;
type SectionSummary = {
  gradeLevel: string;
  trackStrand: string | null;
  sectionName: string;
};

const allowedStatusTransitions: Record<
  EnrollmentStatus,
  readonly EnrollmentStatus[]
> = {
  ACTIVE: ["COMPLETED", "DROPPED", "TRANSFERRED"],
  COMPLETED: [],
  DROPPED: [],
  TRANSFERRED: [],
};

export async function getEnrollments(): Promise<EnrollmentListItem[]> {
  await requirePermission(Permissions.ENROLLMENT);

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
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
  }));
}

export async function getEnrollmentFormOptions() {
  await requirePermission(Permissions.ENROLLMENT);

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

function getSectionName(section: SectionSummary | null) {
  if (!section) {
    return "NONE";
  }

  return `Grade ${section.gradeLevel}${section.trackStrand ? ` - ${section.trackStrand}` : ""} - ${section.sectionName}`;
}

function addStudentSynchronizationChanges(
  changes: AuditChanges,
  previous: {
    status: StudentStatus;
    currentSectionId: string | null;
    currentSection: SectionSummary | null;
  },
  next: {
    status: StudentStatus;
    currentSectionId: string | null;
    currentSection: SectionSummary | null;
  },
) {
  if (previous.status !== next.status) {
    changes["student.status"] = {
      from: previous.status,
      to: next.status,
    };
  }

  if (previous.currentSectionId !== next.currentSectionId) {
    changes["student.currentSectionId"] = {
      from: previous.currentSectionId ?? "NONE",
      to: next.currentSectionId ?? "NONE",
    };
    changes["student.currentSection"] = {
      from: getSectionName(previous.currentSection),
      to: getSectionName(next.currentSection),
    };
  }
}

async function synchronizeStudentFromEnrollments(
  studentId: string,
  transaction: Prisma.TransactionClient,
) {
  const activeEnrollment = await findLatestActiveEnrollmentByStudent(
    studentId,
    transaction,
  );

  let status: StudentStatus = "ENROLLED";
  let currentSectionId: string | null = activeEnrollment?.sectionId ?? null;
  let currentSection: SectionSummary | null = activeEnrollment?.section ?? null;

  if (!activeEnrollment) {
    const terminalEnrollment = await findLatestTerminalEnrollmentByStudent(
      studentId,
      transaction,
    );

    currentSectionId = null;
    currentSection = null;

    if (terminalEnrollment?.status === "COMPLETED") {
      status = "ENROLLED";
    } else if (terminalEnrollment?.status === "TRANSFERRED") {
      status = "TRANSFERRED";
    } else if (terminalEnrollment?.status === "DROPPED") {
      status = "DROPPED";
    } else {
      status = "UNENROLLED";
    }
  }

  await updateStudentEnrollmentSummary(
    studentId,
    {
      status,
      currentSectionId,
    },
    transaction,
  );

  return {
    status,
    currentSectionId,
    currentSection,
  };
}

function validateStatusTransition(
  currentStatus: EnrollmentStatus,
  nextStatus: EnrollmentStatus,
) {
  if (currentStatus === nextStatus) {
    return;
  }

  if (!allowedStatusTransitions[currentStatus].includes(nextStatus)) {
    throw new EnrollmentServiceError(
      `Enrollment status cannot change from ${currentStatus} to ${nextStatus}.`,
    );
  }
}

export async function createEnrollmentService(values: CreateEnrollmentInput) {
  const session = await requirePermission(Permissions.ENROLLMENT);
  const academicYear = values.academicYear.trim();

  try {
    return await prisma.$transaction(async (transaction) => {
      await lockStudentForEnrollmentSynchronization(
        values.studentId,
        transaction,
      );

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

      await updateStudentEnrollmentSummary(
        student.id,
        {
          status: "ENROLLED",
          currentSectionId: enrollment.sectionId,
        },
        transaction,
      );

      const changes: AuditChanges = {};

      addStudentSynchronizationChanges(
        changes,
        student,
        {
          status: "ENROLLED",
          currentSectionId: enrollment.sectionId,
          currentSection: section,
        },
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
            metadata:
              Object.keys(changes).length > 0 ? { changes } : undefined,
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

export async function updateEnrollmentService(
  id: string,
  values: UpdateEnrollmentInput,
) {
  const session = await requirePermission(Permissions.ENROLLMENT);

  return prisma.$transaction(async (transaction) => {
    const enrollmentReference = await findActiveEnrollmentById(id, transaction);

    if (!enrollmentReference) {
      throw new EnrollmentServiceError("Enrollment not found.");
    }

    await lockStudentForEnrollmentSynchronization(
      enrollmentReference.studentId,
      transaction,
    );

    const enrollment = await findActiveEnrollmentById(id, transaction);

    if (!enrollment) {
      throw new EnrollmentServiceError("Enrollment not found.");
    }

    validateStatusTransition(enrollment.status, values.status);

    if (enrollment.status !== "ACTIVE") {
      throw new EnrollmentServiceError(
        "Only active enrollments can be updated.",
      );
    }

    let section = enrollment.section;

    if (values.sectionId !== enrollment.sectionId) {
      const activeSection = await findActiveSectionForAssignment(
        values.sectionId,
        transaction,
      );

      if (!activeSection) {
        throw new EnrollmentServiceError("Section not found or inactive.");
      }

      section = activeSection;
    }

    const changes: AuditChanges = {};

    if (values.sectionId !== enrollment.sectionId) {
      changes.section = {
        from: `${enrollment.sectionId} | Grade ${enrollment.section.gradeLevel}${enrollment.section.trackStrand ? ` - ${enrollment.section.trackStrand}` : ""} - ${enrollment.section.sectionName}`,
        to: `${values.sectionId} | Grade ${section.gradeLevel}${section.trackStrand ? ` - ${section.trackStrand}` : ""} - ${section.sectionName}`,
      };
    }

    if ((values.semester ?? null) !== enrollment.semester) {
      changes.semester = {
        from: enrollment.semester ?? "NONE",
        to: values.semester ?? "NONE",
      };
    }

    if (values.status !== enrollment.status) {
      changes.status = {
        from: enrollment.status,
        to: values.status,
      };
    }

    const updateResult = await updateEnrollment(
      {
        id: enrollment.id,
        deletedAt: null,
        status: "ACTIVE",
      },
      {
        sectionId: values.sectionId,
        semester: values.semester ?? null,
        status: values.status,
      },
      transaction,
    );

    if (updateResult.count !== 1) {
      throw new EnrollmentServiceError(
        "Enrollment is no longer active and cannot be updated.",
      );
    }

    const synchronizedStudent = await synchronizeStudentFromEnrollments(
      enrollment.studentId,
      transaction,
    );

    addStudentSynchronizationChanges(
      changes,
      enrollment.student,
      synchronizedStudent,
    );

    const changedFields = Object.keys(changes);
    const description =
      changedFields.length > 0
        ? `Updated enrollment ${changedFields.join(" and ")}`
        : "Updated enrollment";

    await createAuditLogs(
      [
        {
          userId: session.user.id,
          action: "UPDATE",
          module: "Enrollment",
          recordId: enrollment.id,
          recordName: `${enrollment.student.lrn} - ${getStudentName(enrollment.student)} - ${enrollment.academicYear}`,
          description,
          metadata: changedFields.length > 0 ? { changes } : undefined,
        },
      ],
      transaction,
    );

    return enrollment.id;
  });
}
