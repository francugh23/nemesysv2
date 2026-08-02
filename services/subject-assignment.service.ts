import { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  findActiveSectionForAssignment,
  findActiveSectionsForAssignment,
} from "@/repositories/section.repository";
import {
  createSubjectAssignment,
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
  const assignments = await findAllSubjectAssignments();

  return assignments.map((assignment) => ({
    id: assignment.id,
    teacherId: assignment.teacherId,
    subjectId: assignment.subjectId,
    sectionId: assignment.sectionId,
    employeeNumber: assignment.teacher.user.employeeNumber,
    teacherFirstName: assignment.teacher.user.firstName,
    teacherMiddleName: assignment.teacher.user.middleName,
    teacherLastName: assignment.teacher.user.lastName,
    subjectCode: assignment.subject.code,
    subjectDescription: assignment.subject.description,
    sectionGradeLevel: assignment.section.gradeLevel,
    sectionTrackStrand: assignment.section.trackStrand,
    sectionName: assignment.section.sectionName,
    academicYear: assignment.academicYear,
  }));
}

export async function getSubjectAssignmentOptions() {
  const [teachers, subjects, sections] = await Promise.all([
    findActiveTeachersForAssignment(),
    findSubjects(),
    findActiveSectionsForAssignment(),
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
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const [teacher, subject, section] = await Promise.all([
        findActiveTeacherForAssignment(values.teacherId, transaction),
        findActiveSubjectById(values.subjectId, transaction),
        findActiveSectionForAssignment(values.sectionId, transaction),
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
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized.");
  }

  try {
    return await prisma.$transaction(async (transaction) => {
      const [assignment, teacher, subject, section] = await Promise.all([
        findActiveSubjectAssignmentById(id, transaction),
        findActiveTeacherForAssignment(values.teacherId, transaction),
        findActiveSubjectById(values.subjectId, transaction),
        findActiveSectionForAssignment(values.sectionId, transaction),
      ]);

      if (!assignment) {
        throw new Error("Subject assignment not found.");
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
