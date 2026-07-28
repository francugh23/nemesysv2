import * as z from "zod";

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
