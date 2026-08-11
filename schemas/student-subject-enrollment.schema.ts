import * as z from "zod";

export const StudentSubjectEnrollmentStatusSchema = z.enum(["ACTIVE", "REPLACED"]);

export const StudentSubjectEnrollmentReadSchema = z.object({
  enrollmentId: z.string().min(1),
  status: StudentSubjectEnrollmentStatusSchema.optional(),
});

export type StudentSubjectEnrollmentReadInput = z.input<
  typeof StudentSubjectEnrollmentReadSchema
>;
export type StudentSubjectEnrollmentRead = z.output<
  typeof StudentSubjectEnrollmentReadSchema
>;
