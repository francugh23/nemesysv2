import * as z from "zod";

export const StudentSubjectEnrollmentStatusSchema = z.enum([
  "ACTIVE",
  "REPLACED",
  "DROPPED",
]);

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

export const ShsCurrentTermProgressionSchema = z.object({
  enrollmentId: z.string().min(1),
  subjectOfferingIds: z.array(z.string().min(1)).superRefine((offeringIds, context) => {
    if (new Set(offeringIds).size !== offeringIds.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Offerings must be unique." });
  }),
}).strict();

export const DropStudentSubjectEnrollmentSchema = z.object({
  enrollmentId: z.string().min(1),
  studentSubjectEnrollmentId: z.string().min(1),
  reason: z.string().trim().min(1, "Drop reason is required.").max(500, "Drop reason must not exceed 500 characters."),
}).strict();

export type ShsCurrentTermProgressionInput = z.infer<typeof ShsCurrentTermProgressionSchema>;
export type DropStudentSubjectEnrollmentInput = z.infer<typeof DropStudentSubjectEnrollmentSchema>;
