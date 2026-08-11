import * as z from "zod";

export const CurriculumAdoptionTermMappingSchema = z.object({
  sourceAcademicTermId: z.string().trim().min(1),
  destinationAcademicTermId: z.string().trim().min(1),
});

export const CurriculumAdoptionOptionsSchema = z.object({
  destinationAcademicYearId: z.string().trim().min(1),
});

export const CurriculumAdoptionPreviewSchema = z
  .object({
    sourceAcademicYearId: z.string().trim().min(1),
    destinationAcademicYearId: z.string().trim().min(1),
    termMappings: z.array(CurriculumAdoptionTermMappingSchema).min(1),
  })
  .superRefine((values, context) => {
    if (values.sourceAcademicYearId === values.destinationAcademicYearId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationAcademicYearId"],
        message: "Destination Academic Year must be different from the source Academic Year.",
      });
    }

    const sourceIds = values.termMappings.map(({ sourceAcademicTermId }) => sourceAcademicTermId);
    const destinationIds = values.termMappings.map(({ destinationAcademicTermId }) => destinationAcademicTermId);
    if (new Set(sourceIds).size !== sourceIds.length || new Set(destinationIds).size !== destinationIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["termMappings"],
        message: "Academic Term mappings must be one-to-one.",
      });
    }
  });

export const CommitCurriculumAdoptionSchema = CurriculumAdoptionPreviewSchema.safeExtend({
  selectedSourceOfferingIds: z.array(z.string().trim().min(1)).min(1),
}).superRefine((values, context) => {
  if (new Set(values.selectedSourceOfferingIds).size !== values.selectedSourceOfferingIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selectedSourceOfferingIds"],
      message: "Selected source Subject Offerings must be unique.",
    });
  }
});

export type CurriculumAdoptionPreviewInput = z.infer<typeof CurriculumAdoptionPreviewSchema>;
export type CommitCurriculumAdoptionInput = z.infer<typeof CommitCurriculumAdoptionSchema>;
