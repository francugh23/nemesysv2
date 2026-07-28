import * as z from "zod";

export const CreateSubjectSchema = z.object({
  code: z.string().trim().min(1, "Subject code is required."),
  description: z.string().trim().min(1, "Description is required."),
  gradeLevel: z.string().trim().min(1, "Grade level is required."),
  trackStrand: z.string().trim().optional(),
  semester: z.enum(["FIRST", "SECOND"]).optional(),
});

export const SubjectListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string(),
  gradeLevel: z.string(),
  trackStrand: z.string().nullable(),
  semester: z.enum(["FIRST", "SECOND"]).nullable(),
});

export type SubjectListItem = z.infer<typeof SubjectListItemSchema>;
