import { Prisma, type StudentStatus } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import { isAcademicYearWritable } from "@/lib/academic-year";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createEnrollment,
  countNonArchivedEnrollments,
  findActiveAcademicYearsForEnrollment,
  findActiveEnrollmentById,
  findEnrollmentFilterOptionValues,
  findEnrollmentByIdentity,
  findLatestActiveEnrollmentByStudent,
  findLatestTerminalEnrollmentByStudent,
  findNonArchivedEnrollments,
  findNonArchivedEnrollmentsByGrade,
  lockAcademicYearForEnrollment,
  updateEnrollment,
} from "@/repositories/enrollment.repository";
import { deriveApprovedRegularJhsStudentSubjectEnrollments } from "@/services/jhs-student-subject-enrollment-derivation.service";
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
  EnrollmentFilterOptions,
  EnrollmentListItem,
  EnrollmentPage,
  EnrollmentTableQuery,
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

function getEnrollmentOrderBy(
  query: EnrollmentTableQuery,
): Prisma.EnrollmentOrderByWithRelationInput[] {
  const direction = query.direction ?? "asc";

  switch (query.sort) {
    case "studentLrn":
      return [{ student: { lrn: direction } }, { id: "asc" }];
    case "studentName":
      return [
        { student: { lastName: direction } },
        { student: { firstName: direction } },
        { student: { lrn: direction } },
        { id: "asc" },
      ];
    case "sectionGradeLevel":
      return [{ section: { gradeLevel: direction } }, { id: "asc" }];
    case "sectionTrackStrand":
      return [{ section: { trackStrand: direction } }, { id: "asc" }];
    case "sectionName":
      return [{ section: { sectionName: direction } }, { id: "asc" }];
    case "academicYear":
      return [
        { academicYear: { startDate: direction } },
        { academicYearId: direction },
        { id: "asc" },
      ];
    case "status":
      return [{ status: direction }, { id: "asc" }];
    default:
      return [
        { academicYear: { startDate: "desc" } },
        { academicYearId: "desc" },
        { student: { lastName: "asc" } },
        { student: { firstName: "asc" } },
        { student: { lrn: "asc" } },
        { id: "asc" },
      ];
  }
}

export async function getEnrollments(
  query: EnrollmentTableQuery,
): Promise<EnrollmentPage> {
  await requirePermission(Permissions.ENROLLMENT);

  const filters = {
    search: query.q,
    status: query.status,
    gradeLevel: query.gradeLevel,
    academicYearId: query.academicYearId,
    sectionId: query.sectionId,
  };
  const totalCount = await countNonArchivedEnrollments(filters);
  const pageCount = Math.ceil(totalCount / query.pageSize);
  const page = Math.min(query.page, Math.max(pageCount, 1));
  const pagination = {
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
  };
  const enrollments =
    query.sort === "sectionGradeLevel"
      ? await findNonArchivedEnrollmentsByGrade(
          filters,
          pagination,
          query.direction ?? "asc",
        )
      : await findNonArchivedEnrollments(
          filters,
          pagination,
          getEnrollmentOrderBy(query),
        );

  return {
    items: enrollments.map((enrollment): EnrollmentListItem => ({
      id: enrollment.id,
      studentId: enrollment.studentId,
      sectionId: enrollment.sectionId,
      academicYearId: enrollment.academicYearId,
      studentLrn: enrollment.student.lrn,
      studentFirstName: enrollment.student.firstName,
      studentMiddleName: enrollment.student.middleName,
      studentLastName: enrollment.student.lastName,
      sectionGradeLevel: enrollment.section.gradeLevel,
      sectionTrackStrand: enrollment.section.trackStrand,
      sectionName: enrollment.section.sectionName,
      academicYear: enrollment.academicYear.label,
      academicYearStatus: enrollment.academicYear.status,
      status: enrollment.status,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    })),
    totalCount,
    page,
    pageSize: query.pageSize,
    pageCount,
  };
}

export async function getEnrollmentFilterOptions(): Promise<EnrollmentFilterOptions> {
  await requirePermission(Permissions.ENROLLMENT);

  const [academicYears, sections] = await findEnrollmentFilterOptionValues();

  return {
    academicYears,
    gradeLevels: [...new Set(sections.map((section) => section.gradeLevel))].sort(
      (first, second) => Number(first) - Number(second),
    ),
    sections: sections.sort((first, second) => {
      const gradeDifference = Number(first.gradeLevel) - Number(second.gradeLevel);

      if (gradeDifference !== 0) {
        return gradeDifference;
      }

      const trackDifference = (first.trackStrand ?? "").localeCompare(
        second.trackStrand ?? "",
      );

      return trackDifference !== 0
        ? trackDifference
        : first.sectionName.localeCompare(second.sectionName);
    }),
  };
}

export async function getEnrollmentFormOptions() {
  await requirePermission(Permissions.ENROLLMENT);

  const [students, sections, academicYears] = await Promise.all([
    findActiveStudentsForEnrollment(),
    findActiveSectionsForAssignment(),
    findActiveAcademicYearsForEnrollment(),
  ]);

  return {
    students,
    sections,
    academicYears,
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

async function createEnrollmentInTransaction(
  values: CreateEnrollmentInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  await lockStudentForEnrollmentSynchronization(
    values.studentId,
    transaction,
  );

  const [student, section, academicYear] = await Promise.all([
    findActiveStudentForEnrollment(values.studentId, transaction),
    findActiveSectionForAssignment(values.sectionId, transaction),
    lockAcademicYearForEnrollment(values.academicYearId, transaction),
  ]);

  if (!student) {
    throw new EnrollmentServiceError("Student not found or inactive.");
  }

  if (!section) {
    throw new EnrollmentServiceError("Section not found or inactive.");
  }

  if (!academicYear || !isAcademicYearWritable(academicYear.status)) {
    throw new EnrollmentServiceError(
      "Academic year not found or is not active.",
    );
  }

  const duplicate = await findEnrollmentByIdentity(
    {
      studentId: student.id,
      academicYearId: academicYear.id,
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
      academicYearId: academicYear.id,
      createdById: actorId,
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

  await deriveApprovedRegularJhsStudentSubjectEnrollments(
    {
      enrollmentId: enrollment.id,
      academicYearId: academicYear.id,
      academicYearLabel: academicYear.label,
      gradeLevel: section.gradeLevel,
      trackStrand: section.trackStrand,
      studentLrn: student.lrn,
      actorId,
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
        userId: actorId,
        action: "CREATE",
        module: "Enrollment",
        recordId: enrollment.id,
        recordName: `${student.lrn} - ${getStudentName(student)} - ${academicYear.label}`,
        description: `Created enrollment in ${section.sectionName}`,
        metadata: Object.keys(changes).length > 0 ? { changes } : undefined,
      },
    ],
    transaction,
  );

  return enrollment;
}

export async function createEnrollmentService(values: CreateEnrollmentInput) {
  const session = await requirePermission(Permissions.ENROLLMENT);

  try {
    return await prisma.$transaction((transaction) =>
      createEnrollmentInTransaction(values, session.user.id, transaction),
    );
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

    if (!isAcademicYearWritable(enrollmentReference.academicYear.status)) {
      throw new EnrollmentServiceError(
        enrollmentReference.academicYear.status === "LOCKED" ||
          enrollmentReference.academicYear.status === "ARCHIVED"
          ? "Enrollment is read-only because its academic year is locked or archived."
          : "Enrollment cannot be updated because its academic year is not active.",
      );
    }

    await lockStudentForEnrollmentSynchronization(
      enrollmentReference.studentId,
      transaction,
    );

    const academicYearReference = await lockAcademicYearForEnrollment(
      enrollmentReference.academicYearId,
      transaction,
    );

    if (
      !academicYearReference ||
      !isAcademicYearWritable(academicYearReference.status)
    ) {
      throw new EnrollmentServiceError(
        academicYearReference?.status === "LOCKED" ||
          academicYearReference?.status === "ARCHIVED"
          ? "Enrollment is read-only because its academic year is locked or archived."
          : "Enrollment cannot be updated because its academic year is not active.",
      );
    }

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
        academicYear: { status: "ACTIVE" },
      },
      {
        sectionId: values.sectionId,
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
          recordName: `${enrollment.student.lrn} - ${getStudentName(enrollment.student)} - ${enrollment.academicYear.label}`,
          description,
          metadata: changedFields.length > 0 ? { changes } : undefined,
        },
      ],
      transaction,
    );

    return enrollment.id;
  });
}
