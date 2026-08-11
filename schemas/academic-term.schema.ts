import * as z from "zod";

import { AcademicYearDateSchema } from "./academic-year.schema";

const AcademicTermFieldsSchema = z
  .object({
    name: z.string().trim().min(1, "Term name is required.").max(100),
    position: z.number().int().min(1, "Term position must be positive."),
    startDate: AcademicYearDateSchema,
    endDate: AcademicYearDateSchema,
  })
  .superRefine((values, context) => {
    if (values.startDate >= values.endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be after start date.",
      });
    }
  });

export const CreateAcademicTermSchema = AcademicTermFieldsSchema;
export const UpdateAcademicTermSchema = AcademicTermFieldsSchema;

export type CreateAcademicTermInput = z.infer<typeof CreateAcademicTermSchema>;
export type UpdateAcademicTermInput = z.infer<typeof UpdateAcademicTermSchema>;

export const AcademicTermListItemSchema = z.object({
  id: z.string(),
  academicYearId: z.string(),
  name: z.string(),
  position: z.number().int(),
  startDate: z.date(),
  endDate: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AcademicTermListItem = z.infer<typeof AcademicTermListItemSchema>;
