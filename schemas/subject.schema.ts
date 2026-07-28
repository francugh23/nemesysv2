import * as z from "zod";
import { isJhsGradeLevel, SUBJECT_GRADE_LEVELS } from "@/lib/subject-identity";

const SubjectFieldsSchema = z
  .object({
  code: z.string().trim().min(1, "Subject code is required."),
  description: z.string().trim().min(1, "Description is required."),
  gradeLevel: z.enum(SUBJECT_GRADE_LEVELS),
  trackStrand: z.string().trim().optional(),
  semester: z.enum(["FIRST", "SECOND"]).optional(),
  })
  .superRefine((values, context) => {
    if (isJhsGradeLevel(values.gradeLevel) && values.trackStrand) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackStrand"],
        message: "Track/strand is only applicable to Grades 11 and 12.",
      });
    }
  });

export const CreateSubjectSchema = SubjectFieldsSchema;
export const UpdateSubjectSchema = SubjectFieldsSchema;

export const SubjectListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string(),
  gradeLevel: z.string(),
  trackStrand: z.string().nullable(),
  semester: z.enum(["FIRST", "SECOND"]).nullable(),
});

export type SubjectListItem = z.infer<typeof SubjectListItemSchema>;
