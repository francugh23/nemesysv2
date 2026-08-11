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

export const ShsStudentCurriculumSelectionSchema = z.object({
  enrollmentId: z.string().min(1),
  subjectOfferingIds: z.array(z.string().min(1)).superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Offerings must be unique." });
  }),
});
export type ShsStudentCurriculumSelectionInput = z.infer<typeof ShsStudentCurriculumSelectionSchema>;
