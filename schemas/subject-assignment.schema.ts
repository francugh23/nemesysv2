import * as z from "zod";

const SubjectAssignmentFieldsSchema = z.object({
  teacherId: z.string().min(1, "Teacher is required."),
  subjectOfferingId: z.string().min(1, "Curriculum Offering is required."),
  academicTermId: z.string().min(1, "Academic Term is required."),
  sectionId: z.string().min(1, "Section is required."),
});

export const CreateSubjectAssignmentSchema = SubjectAssignmentFieldsSchema;
export const UpdateSubjectAssignmentSchema = SubjectAssignmentFieldsSchema;

export const AssignmentMatrixQuerySchema = z.object({
  academicYearId: z.string().min(1).optional(),
  gradeLevel: z.enum(["7", "8", "9", "10", "11", "12"]),
});

export type AssignmentMatrixQuery = z.output<typeof AssignmentMatrixQuerySchema>;

export const SubjectAssignmentListItemSchema = z.object({
  id: z.string(),
  teacherId: z.string(),
  subjectOfferingId: z.string(),
  academicTermId: z.string(),
  sectionId: z.string(),
  employeeNumber: z.string().nullable(),
  teacherFirstName: z.string(),
  teacherMiddleName: z.string().nullable(),
  teacherLastName: z.string(),
  subjectOfferingCode: z.string(),
  subjectOfferingDescription: z.string(),
  academicTermName: z.string(),
  academicTermPosition: z.number(),
  sectionGradeLevel: z.string(),
  sectionName: z.string(),
  academicYearLabel: z.string(),
  academicYearStatus: z.enum(["DRAFT", "ACTIVE", "LOCKED", "ARCHIVED"]),
});

export type SubjectAssignmentListItem = z.infer<
  typeof SubjectAssignmentListItemSchema
>;
