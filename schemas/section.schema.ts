import * as z from "zod";

export const SectionListItemSchema = z.object({
  id: z.string(),
  gradeLevel: z.string(),
  trackStrand: z.string().nullable(),
  sectionName: z.string(),
  adviserFirstName: z.string().nullable(),
  adviserMiddleName: z.string().nullable(),
  adviserLastName: z.string().nullable(),
  room: z.string().nullable(),
  shift: z.enum(["MORNING", "AFTERNOON"]).nullable(),
});

export type SectionListItem = z.infer<typeof SectionListItemSchema>;
