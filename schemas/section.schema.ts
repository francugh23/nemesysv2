import * as z from "zod";

export const SECTION_GRADE_LEVELS = [
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;

export const CreateSectionSchema = z
  .object({
    gradeLevel: z.enum(SECTION_GRADE_LEVELS),
    trackStrand: z.string().trim().optional(),
    sectionName: z.string().trim().min(1, "Section name is required."),
    adviserId: z.string().optional(),
    room: z.string().trim().optional(),
    shift: z.enum(["MORNING", "AFTERNOON"]).optional(),
  })
  .superRefine((values, context) => {
    if (
      ["7", "8", "9", "10"].includes(values.gradeLevel) &&
      values.trackStrand
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackStrand"],
        message: "Track/strand is only applicable to Grades 11 and 12.",
      });
    }
  });

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
