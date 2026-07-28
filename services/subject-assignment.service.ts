import { findAllSubjectAssignments } from "@/repositories/subject-assignment.repository";
import type { SubjectAssignmentListItem } from "@/schemas";

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
