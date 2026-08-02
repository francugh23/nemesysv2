import * as z from "zod";

const SubjectAssignmentFieldsSchema = z.object({
  teacherId: z.string().min(1, "Teacher is required."),
  subjectId: z.string().min(1, "Subject is required."),
  sectionId: z.string().min(1, "Section is required."),
  academicYear: z.string().trim().min(1, "Academic year is required."),
});

export const CreateSubjectAssignmentSchema = SubjectAssignmentFieldsSchema;
export const UpdateSubjectAssignmentSchema = SubjectAssignmentFieldsSchema;

export const SubjectAssignmentListItemSchema = z.object({
  id: z.string(),
  teacherId: z.string(),
  subjectId: z.string(),
  sectionId: z.string(),
  employeeNumber: z.string().nullable(),
  teacherFirstName: z.string(),
  teacherMiddleName: z.string().nullable(),
  teacherLastName: z.string(),
  subjectCode: z.string(),
  subjectDescription: z.string(),
  sectionGradeLevel: z.string(),
  sectionTrackStrand: z.string().nullable(),
  sectionName: z.string(),
  academicYear: z.string(),
});

export type SubjectAssignmentListItem = z.infer<
  typeof SubjectAssignmentListItemSchema
>;
