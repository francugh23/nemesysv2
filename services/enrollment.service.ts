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
  lockAcademicTermForEnrollment,
  updateEnrollment,
} from "@/repositories/enrollment.repository";
import {
  deriveApprovedRegularJhsStudentSubjectEnrollments,
  reconcileApprovedRegularJhsStudentSubjectEnrollments,
} from "@/services/jhs-student-subject-enrollment-derivation.service";
import {
  getEnrollmentFoundationValidationError,
  getEnrollmentPlacementCompatibilityError,
} from "@/services/enrollment-foundation.service";
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
import {
  EnrollmentLifecycleError,
  transitionEnrollmentInTransaction,
} from "@/services/enrollment-lifecycle.service";
import type {
  CreateEnrollmentInput,
  CorrectEnrollmentPlacementInput,
  EnrollmentFilterOptions,
  EnrollmentListItem,
  EnrollmentPage,
  EnrollmentTableQuery,
  TransitionEnrollmentInput,
} from "@/schemas";

export class EnrollmentServiceError extends Error {}

type AuditChanges = Record<string, { from: string; to: string }>;
type SectionSummary = {
  gradeLevel: string;
  trackStrand: string | null;
  sectionName: string;
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
    trackStrand: query.trackStrand,
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
      shsTrack: enrollment.shsTrack,
      entryAcademicTermId: enrollment.entryAcademicTermId,
      entryAcademicTermName: enrollment.entryAcademicTerm?.name ?? null,
      entryAcademicTermPosition: enrollment.entryAcademicTerm?.position ?? null,
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
    trackStrands: [
      ...new Set(
        sections.flatMap((section) =>
          section.trackStrand ? [section.trackStrand] : [],
        ),
      ),
    ].sort((first, second) => first.localeCompare(second)),
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

async function createEnrollmentInTransaction(
  values: CreateEnrollmentInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  await lockStudentForEnrollmentSynchronization(
    values.studentId,
    transaction,
  );

  const [student, section, academicYear, entryAcademicTerm] = await Promise.all([
    findActiveStudentForEnrollment(values.studentId, transaction),
    findActiveSectionForAssignment(values.sectionId, transaction),
    lockAcademicYearForEnrollment(values.academicYearId, transaction),
    values.entryAcademicTermId
      ? lockAcademicTermForEnrollment(values.entryAcademicTermId, transaction)
      : Promise.resolve(null),
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

  const foundationValidationError = getEnrollmentFoundationValidationError({
    academicYearId: academicYear.id,
    entryAcademicTerm,
    gradeLevel: section.gradeLevel,
    shsTrack: values.shsTrack,
  });
  if (foundationValidationError) {
    throw new EnrollmentServiceError(foundationValidationError);
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
      entryAcademicTermId: entryAcademicTerm?.id ?? null,
      shsTrack: values.shsTrack ?? null,
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
  if (entryAcademicTerm) {
    changes.entryAcademicTerm = {
      from: "NONE",
      to: `${entryAcademicTerm.id} | ${entryAcademicTerm.name}`,
    };
  }
  if (values.shsTrack) {
    changes.shsTrack = { from: "NONE", to: values.shsTrack };
  }

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

function getReadOnlyEnrollmentMessage(status?: string) {
  return status === "LOCKED" || status === "ARCHIVED"
    ? "Enrollment is read-only because its academic year is locked or archived."
    : "Enrollment cannot be updated because its academic year is not active.";
}

export async function correctEnrollmentPlacementInTransaction(
  id: string,
  values: CorrectEnrollmentPlacementInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  const enrollmentReference = await findActiveEnrollmentById(id, transaction);

  if (!enrollmentReference) {
    throw new EnrollmentServiceError("Enrollment not found.");
  }

  if (!isAcademicYearWritable(enrollmentReference.academicYear.status)) {
    throw new EnrollmentServiceError(
      getReadOnlyEnrollmentMessage(enrollmentReference.academicYear.status),
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
      getReadOnlyEnrollmentMessage(academicYearReference?.status),
    );
  }

  const enrollment = await findActiveEnrollmentById(id, transaction);

  if (!enrollment) {
    throw new EnrollmentServiceError("Enrollment not found.");
  }

  if (enrollment.status !== "ACTIVE") {
    throw new EnrollmentServiceError(
      "Only active enrollments can have their placement corrected.",
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


  const placementCompatibilityError = getEnrollmentPlacementCompatibilityError({
    destinationGradeLevel: section.gradeLevel,
    entryAcademicTermId: enrollment.entryAcademicTermId,
    shsTrack: enrollment.shsTrack,
  });
  if (placementCompatibilityError) {
    throw new EnrollmentServiceError(placementCompatibilityError);
  }

  const changes: AuditChanges = {};

  if (values.sectionId !== enrollment.sectionId) {
    changes.section = {
      from: `${enrollment.sectionId} | Grade ${enrollment.section.gradeLevel}${enrollment.section.trackStrand ? ` - ${enrollment.section.trackStrand}` : ""} - ${enrollment.section.sectionName}`,
      to: `${values.sectionId} | Grade ${section.gradeLevel}${section.trackStrand ? ` - ${section.trackStrand}` : ""} - ${section.sectionName}`,
    };
  }

  const updateResult = await updateEnrollment(
    {
      id: enrollment.id,
      deletedAt: null,
      status: "ACTIVE",
      academicYear: { status: "ACTIVE" },
    },
    { sectionId: values.sectionId },
    transaction,
  );

  if (updateResult.count !== 1) {
    throw new EnrollmentServiceError(
      "Enrollment is no longer active and cannot be updated.",
    );
  }

  if (values.sectionId !== enrollment.sectionId) {
    await reconcileApprovedRegularJhsStudentSubjectEnrollments(
      {
        enrollmentId: enrollment.id,
        academicYearId: enrollment.academicYearId,
        academicYearLabel: enrollment.academicYear.label,
        enrollmentStatus: "ACTIVE",
        previousSection: enrollment.section,
        nextSection: section,
        studentLrn: enrollment.student.lrn,
        actorId,
      },
      transaction,
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

  await createAuditLogs(
    [{
      userId: actorId,
      action: "UPDATE",
      module: "Enrollment",
      recordId: enrollment.id,
      recordName: `${enrollment.student.lrn} - ${getStudentName(enrollment.student)} - ${enrollment.academicYear.label}`,
      description: changedFields.length
        ? "Corrected enrollment placement."
        : "Confirmed enrollment placement without changes.",
      metadata: changedFields.length ? { changes } : undefined,
    }],
    transaction,
  );

  return enrollment.id;
}

export async function correctEnrollmentPlacementService(
  id: string,
  values: CorrectEnrollmentPlacementInput,
) {
  const session = await requirePermission(Permissions.ENROLLMENT);
  return prisma.$transaction((transaction) =>
    correctEnrollmentPlacementInTransaction(
      id,
      values,
      session.user.id,
      transaction,
    ),
  );
}

export async function transitionEnrollmentService(
  id: string,
  values: TransitionEnrollmentInput,
) {
  const session = await requirePermission(Permissions.ENROLLMENT);
  try {
    return await prisma.$transaction((transaction) =>
      transitionEnrollmentInTransaction(
        id,
        values,
        session.user.id,
        transaction,
      ),
    );
  } catch (error) {
    if (error instanceof EnrollmentLifecycleError) {
      throw new EnrollmentServiceError(error.message);
    }
    throw error;
  }
}
