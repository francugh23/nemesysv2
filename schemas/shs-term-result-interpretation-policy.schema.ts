import * as z from "zod";

export const ShsTermResultInterpretationPolicyReadSchema = z.object({
  academicYearId: z.string().min(1),
});

export const SaveShsTermResultInterpretationPolicyDraftSchema = z.object({
  academicYearId: z.string().min(1),
  passingThreshold: z.literal(75),
  sourceReference: z.string().trim().min(1, "A school-approved source reference is required."),
});

export const PublishShsTermResultInterpretationPolicySchema = z.object({
  academicYearId: z.string().min(1),
  policyId: z.string().min(1),
});

export type ShsTermResultInterpretationPolicyReadInput = z.infer<
  typeof ShsTermResultInterpretationPolicyReadSchema
>;
export type SaveShsTermResultInterpretationPolicyDraftInput = z.infer<
  typeof SaveShsTermResultInterpretationPolicyDraftSchema
>;
export type PublishShsTermResultInterpretationPolicyInput = z.infer<
  typeof PublishShsTermResultInterpretationPolicySchema
>;
