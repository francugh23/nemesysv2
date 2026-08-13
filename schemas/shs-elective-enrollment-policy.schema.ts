import * as z from "zod";

export const ShsElectiveEnrollmentPolicyListSchema = z.object({
  academicYearId: z.string().min(1).optional(),
});

const ShsElectiveEnrollmentPolicyFieldsSchema = z
  .object({
    academicYearId: z.string().min(1),
    academicTermId: z.string().min(1),
    gradeLevel: z.enum(["11", "12"]),
    minimumElectives: z.number().int().min(1).max(3),
    maximumElectives: z.number().int().min(1).max(3),
  })
  .refine(
    ({ minimumElectives, maximumElectives }) =>
      minimumElectives <= maximumElectives,
    {
      message: "Minimum electives cannot exceed maximum electives.",
      path: ["minimumElectives"],
    },
  );

export const CreateShsElectiveEnrollmentPolicySchema =
  ShsElectiveEnrollmentPolicyFieldsSchema;

export const UpdateShsElectiveEnrollmentPolicySchema =
  ShsElectiveEnrollmentPolicyFieldsSchema;

export type ShsElectiveEnrollmentPolicyListInput = z.infer<
  typeof ShsElectiveEnrollmentPolicyListSchema
>;
export type CreateShsElectiveEnrollmentPolicyInput = z.infer<
  typeof CreateShsElectiveEnrollmentPolicySchema
>;
export type UpdateShsElectiveEnrollmentPolicyInput = z.infer<
  typeof UpdateShsElectiveEnrollmentPolicySchema
>;
