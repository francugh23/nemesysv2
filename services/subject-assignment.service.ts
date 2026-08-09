import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { formatFullName } from "@/lib/format";
import { isAcademicYearWritable } from "@/lib/academic-year";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  findActiveSectionForAssignment,
  findActiveSectionsForAssignment,
} from "@/repositories/section.repository";
import {
  archiveSubjectAssignment,
  createSubjectAssignment,
  findActiveAcademicYearsForAssignment,
  findAcademicYearForAssignment,
  findActiveSubjectAssignment,
  findActiveSubjectAssignmentById,
  findActiveSubjectAssignmentExcludingId,
  findAllSubjectAssignments,
  updateSubjectAssignment,
} from "@/repositories/subject-assignment.repository";
import {
  findActiveSubjectById,
  findSubjects,
} from "@/repositories/subject.repository";
import {
  findActiveTeacherForAssignment,
  findActiveTeachersForAssignment,
} from "@/repositories/teacher.repository";
import {
  CreateSubjectAssignmentSchema,
  type SubjectAssignmentListItem,
  UpdateSubjectAssignmentSchema,
} from "@/schemas";
import { z } from "zod";

export async function getSubjectAssignments(): Promise<
  SubjectAssignmentListItem[]
> {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);

  const assignments = await findAllSubjectAssignments();

  return assignments.map((assignment) => ({
    id: assignment.id,
    teacherId: assignment.teacherId,
    subjectId: assignment.subjectId,
    sectionId: assignment.sectionId,
    academicYearId: assignment.academicYearId,
    employeeNumber: assignment.teacher.user.employeeNumber,
    teacherFirstName: assignment.teacher.user.firstName,
    teacherMiddleName: assignment.teacher.user.middleName,
    teacherLastName: assignment.teacher.user.lastName,
    subjectCode: assignment.subject.code,
    subjectDescription: assignment.subject.description,
    sectionGradeLevel: assignment.section.gradeLevel,
    sectionTrackStrand: assignment.section.trackStrand,
    sectionName: assignment.section.sectionName,
    academicYearLabel: assignment.academicYear.label,
    academicYearStatus: assignment.academicYear.status,
  }));
}

export async function getSubjectAssignmentOptions() {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);

  const [teachers, subjects, sections, academicYears] = await Promise.all([
    findActiveTeachersForAssignment(),
    findSubjects(),
    findActiveSectionsForAssignment(),
    findActiveAcademicYearsForAssignment(),
  ]);

  return {
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      employeeNumber: teacher.user.employeeNumber,
      firstName: teacher.user.firstName,
      middleName: teacher.user.middleName,
      lastName: teacher.user.lastName,
    })),
    subjects,
    sections,
    academicYears,
  };
}

function rethrowSubjectAssignmentConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new Error(
      "An active assignment already exists for this teacher, subject, section, and academic year.",
    );
  }

  throw error;
}

export async function createSubjectAssignmentService(
  values: z.infer<typeof CreateSubjectAssignmentSchema>,
) {
  const session = await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);

  try {
    return await prisma.$transaction(async (transaction) => {
      const [teacher, subject, section, academicYear] = await Promise.all([
        findActiveTeacherForAssignment(values.teacherId, transaction),
        findActiveSubjectById(values.subjectId, transaction),
        findActiveSectionForAssignment(values.sectionId, transaction),
        findAcademicYearForAssignment(values.academicYearId, transaction),
      ]);

      if (!teacher) {
        throw new Error("Teacher not found or inactive.");
      }

      if (!subject) {
        throw new Error("Subject not found or archived.");
      }

      if (!section) {
        throw new Error("Section not found or inactive.");
      }

      if (!academicYear || !isAcademicYearWritable(academicYear.status)) {
        throw new Error("Academic year not found or inactive.");
      }

      if (subject.gradeLevel !== section.gradeLevel) {
        throw new Error("Subject and section grade levels must match.");
      }

      if (
        subject.trackStrand !== null &&
        subject.trackStrand !== section.trackStrand
      ) {
        throw new Error("Subject and section track/strand must match.");
      }

      const duplicate = await findActiveSubjectAssignment(values, transaction);

      if (duplicate) {
        throw new Error(
          "An active assignment already exists for this teacher, subject, section, and academic year.",
        );
      }

      const assignment = await createSubjectAssignment(values, transaction);

      await createAuditLogs(
        [
          {
            userId: session.user.id,
            action: "CREATE",
            module: "SubjectAssignment",
            recordId: assignment.id,
            recordName: `${subject.code} - ${section.sectionName}`,
            description: "Created subject assignment",
          },
        ],
        transaction,
      );

      return assignment;
    });
  } catch (error) {
    rethrowSubjectAssignmentConflict(error);
  }
}

export async function updateSubjectAssignmentService(
  id: string,
  values: z.infer<typeof UpdateSubjectAssignmentSchema>,
) {
  const session = await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);

  try {
    return await prisma.$transaction(async (transaction) => {
      const [assignment, teacher, subject, section, targetAcademicYear] =
        await Promise.all([
          findActiveSubjectAssignmentById(id, transaction),
          findActiveTeacherForAssignment(values.teacherId, transaction),
          findActiveSubjectById(values.subjectId, transaction),
          findActiveSectionForAssignment(values.sectionId, transaction),
          findAcademicYearForAssignment(values.academicYearId, transaction),
        ]);

      if (!assignment) {
        throw new Error("Subject assignment not found.");
      }

      if (!isAcademicYearWritable(assignment.academicYear.status)) {
        throw new Error(
          "Subject assignments can only be updated while their academic year is active.",
        );
      }

      if (!teacher) {
        throw new Error("Teacher not found or inactive.");
      }

      if (!subject) {
        throw new Error("Subject not found or archived.");
      }

      if (!section) {
        throw new Error("Section not found or inactive.");
      }

      if (
        !targetAcademicYear ||
        !isAcademicYearWritable(targetAcademicYear.status)
      ) {
        throw new Error("Target academic year not found or inactive.");
      }

      if (subject.gradeLevel !== section.gradeLevel) {
        throw new Error("Subject and section grade levels must match.");
      }

      if (
        subject.trackStrand !== null &&
        subject.trackStrand !== section.trackStrand
      ) {
        throw new Error("Subject and section track/strand must match.");
      }

      const duplicate = await findActiveSubjectAssignmentExcludingId(
        values,
        assignment.id,
        transaction,
      );

      if (duplicate) {
        throw new Error(
          "An active assignment already exists for this teacher, subject, section, and academic year.",
        );
      }

      const updatedAssignment = await updateSubjectAssignment(
        assignment.id,
        values,
        transaction,
      );

      await createAuditLogs(
        [
          {
            userId: session.user.id,
            action: "UPDATE",
            module: "SubjectAssignment",
            recordId: updatedAssignment.id,
            recordName: `${subject.code} - ${section.sectionName}`,
            description: "Updated subject assignment",
          },
        ],
        transaction,
      );

      return updatedAssignment;
    });
  } catch (error) {
    rethrowSubjectAssignmentConflict(error);
  }
}

export async function archiveSubjectAssignmentService(id: string) {
  const session = await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);

  return prisma.$transaction(async (transaction) => {
    const assignment = await findActiveSubjectAssignmentById(id, transaction);

    if (!assignment) {
      throw new Error("Subject assignment not found.");
    }

    const academicYear = await findAcademicYearForAssignment(
      assignment.academicYearId,
      transaction,
    );

    if (!academicYear || !isAcademicYearWritable(academicYear.status)) {
      throw new Error(
        "Subject assignments can only be archived while their academic year is active.",
      );
    }

    const archivedAssignment = await archiveSubjectAssignment(
      assignment.id,
      transaction,
    );
    const teacherName = formatFullName(
      assignment.teacher.user.firstName,
      assignment.teacher.user.middleName,
      assignment.teacher.user.lastName,
    );
    const teacherIdentity = assignment.teacher.user.employeeNumber
      ? `${assignment.teacher.user.employeeNumber} - ${teacherName}`
      : teacherName;
    const sectionIdentity = `Grade ${assignment.section.gradeLevel}${assignment.section.trackStrand ? ` - ${assignment.section.trackStrand}` : ""} - ${assignment.section.sectionName}`;

    await createAuditLogs(
      [
        {
          userId: session.user.id,
          action: "ARCHIVE",
          module: "SubjectAssignment",
          recordId: archivedAssignment.id,
          recordName: `Teacher: ${teacherIdentity} | Subject: ${assignment.subject.code} - ${assignment.subject.description} | Section: ${sectionIdentity} | Academic Year: ${assignment.academicYear.label}`,
          description: "Archived subject assignment",
        },
      ],
      transaction,
    );

    return archivedAssignment;
  });
}
