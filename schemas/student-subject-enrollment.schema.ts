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
  selections: z.array(z.object({
    subjectOfferingId: z.string().min(1),
    academicTermIds: z.array(z.string().min(1)).min(1, "Select at least one Academic Term.").superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Academic Terms must be unique." });
    }),
  })).superRefine((selections, context) => {
    const offeringIds = selections.map(({ subjectOfferingId }) => subjectOfferingId);
    if (new Set(offeringIds).size !== offeringIds.length) context.addIssue({ code: z.ZodIssueCode.custom, message: "Offerings must be unique." });
  }),
});
export type ShsStudentCurriculumSelectionInput = z.infer<typeof ShsStudentCurriculumSelectionSchema>;
