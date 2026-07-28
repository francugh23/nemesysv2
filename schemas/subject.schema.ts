import * as z from "zod";

export const SubjectListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  description: z.string(),
  gradeLevel: z.string(),
  trackStrand: z.string().nullable(),
  semester: z.enum(["FIRST", "SECOND"]).nullable(),
});

export type SubjectListItem = z.infer<typeof SubjectListItemSchema>;
