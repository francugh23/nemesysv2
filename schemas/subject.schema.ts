import * as z from "zod";
import { isJhsGradeLevel, SUBJECT_GRADE_LEVELS } from "@/lib/subject-identity";

export const SubjectGradeLevelSchema = z.enum(SUBJECT_GRADE_LEVELS);

const SubjectFieldsSchema = z.object({
  code: z.string().trim().min(1, "Subject code is required."),
  description: z.string().trim().min(1, "Description is required."),
  gradeLevel: SubjectGradeLevelSchema,
});

export const CreateSubjectSchema = SubjectFieldsSchema;
export const UpdateSubjectSchema = SubjectFieldsSchema;

export const SubjectSortFieldSchema = z.enum([
  "code",
  "description",
  "gradeLevel",
]);

export const SubjectTableQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional(),
    schoolLevel: z.enum(["JHS", "SHS"]).optional(),
    grade: SubjectGradeLevelSchema.optional(),
    sort: SubjectSortFieldSchema.optional(),
    direction: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
  })
  .superRefine((values, context) => {
    if (
      values.schoolLevel &&
      values.grade &&
      ((values.schoolLevel === "JHS" && !isJhsGradeLevel(values.grade)) ||
        (values.schoolLevel === "SHS" && isJhsGradeLevel(values.grade)))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["grade"],
        message: "Grade level does not belong to the selected school level.",
      });
    }
  });

export type SubjectTableQueryInput = z.input<typeof SubjectTableQuerySchema>;
export type SubjectTableQuery = z.output<typeof SubjectTableQuerySchema>;

export const SubjectListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string(),
  gradeLevel: z.string(),
  activeCurriculumCount: z.number().int().nonnegative(),
});

export type SubjectListItem = z.infer<typeof SubjectListItemSchema>;
