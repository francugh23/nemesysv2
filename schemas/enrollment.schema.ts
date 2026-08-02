import * as z from "zod";

export const CreateEnrollmentSchema = z.object({
  studentId: z.string().min(1, "Student is required."),
  sectionId: z.string().min(1, "Section is required."),
  academicYear: z.string().trim().min(1, "Academic year is required."),
  semester: z.enum(["FIRST", "SECOND"]).optional(),
});

export type CreateEnrollmentInput = z.infer<typeof CreateEnrollmentSchema>;

export const EnrollmentListItemSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  sectionId: z.string(),
  studentLrn: z.string(),
  studentFirstName: z.string(),
  studentMiddleName: z.string().nullable(),
  studentLastName: z.string(),
  sectionGradeLevel: z.string(),
  sectionTrackStrand: z.string().nullable(),
  sectionName: z.string(),
  academicYear: z.string(),
  semester: z.enum(["FIRST", "SECOND"]).nullable(),
  status: z.enum(["ACTIVE", "COMPLETED", "DROPPED", "TRANSFERRED"]),
});

export type EnrollmentListItem = z.infer<typeof EnrollmentListItemSchema>;
