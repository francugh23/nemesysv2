import * as z from "zod";
import { isJhsGradeLevel, SUBJECT_GRADE_LEVELS } from "@/lib/subject-identity";

export const SubjectGradeLevelSchema = z.enum(SUBJECT_GRADE_LEVELS);

const SubjectFieldsSchema = z
  .object({
  code: z.string().trim().min(1, "Subject code is required."),
  description: z.string().trim().min(1, "Description is required."),
  gradeLevel: SubjectGradeLevelSchema,
  trackStrand: z.string().trim().optional(),
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

export const SubjectSortFieldSchema = z.enum([
  "code",
  "description",
  "gradeLevel",
  "trackStrand",
]);

export const SubjectTableQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  grade: SubjectGradeLevelSchema.optional(),
  trackStrand: z.string().trim().min(1).max(100).optional(),
  sort: SubjectSortFieldSchema.optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type SubjectTableQueryInput = z.input<typeof SubjectTableQuerySchema>;
export type SubjectTableQuery = z.output<typeof SubjectTableQuerySchema>;

export const SubjectListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string(),
  gradeLevel: z.string(),
  trackStrand: z.string().nullable(),
});

export type SubjectListItem = z.infer<typeof SubjectListItemSchema>;
