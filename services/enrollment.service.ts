import { Prisma, type StudentStatus } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import { isAcademicYearWritable } from "@/lib/academic-year";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createEnrollment,
  countNonArchivedEnrollments,
  findActiveAcademicYearsForEnrollment,
  findEnrollmentFilterOptionValues,
  findEnrollmentByIdentity,
  findNonArchivedEnrollments,
  findNonArchivedEnrollmentsByGrade,
  lockAcademicYearForEnrollment,
  lockAcademicTermForEnrollment,
} from "@/repositories/enrollment.repository";
import {
  deriveApprovedRegularJhsStudentSubjectEnrollments,
} from "@/services/jhs-student-subject-enrollment-derivation.service";
import {
  getEnrollmentFoundationValidationError,
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
      shsTrack: enrollment.shsTrack,
      entryAcademicTermId: enrollment.entryAcademicTermId,
      entryAcademicTermName: enrollment.entryAcademicTerm?.name ?? null,
      entryAcademicTermPosition: enrollment.entryAcademicTerm?.position ?? null,
      studentLrn: enrollment.student.lrn,
      studentFirstName: enrollment.student.firstName,
      studentMiddleName: enrollment.student.middleName,
      studentLastName: enrollment.student.lastName,
      sectionGradeLevel: enrollment.section.gradeLevel,
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

      return first.sectionName.localeCompare(second.sectionName);
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

  return `Grade ${section.gradeLevel} - ${section.sectionName}`;
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
