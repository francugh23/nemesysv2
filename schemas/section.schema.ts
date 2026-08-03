import * as z from "zod";

export const SECTION_GRADE_LEVELS = [
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;

export const SectionGradeLevelSchema = z.enum(SECTION_GRADE_LEVELS);

const SectionFieldsSchema = z
  .object({
    gradeLevel: SectionGradeLevelSchema,
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

export const CreateSectionSchema = SectionFieldsSchema;
export const UpdateSectionSchema = SectionFieldsSchema;

export const SectionListItemSchema = z.object({
  id: z.string(),
  gradeLevel: z.string(),
  trackStrand: z.string().nullable(),
  sectionName: z.string(),
  adviserId: z.string().nullable(),
  adviserFirstName: z.string().nullable(),
  adviserMiddleName: z.string().nullable(),
  adviserLastName: z.string().nullable(),
  room: z.string().nullable(),
  shift: z.enum(["MORNING", "AFTERNOON"]).nullable(),
});

export type SectionListItem = z.infer<typeof SectionListItemSchema>;

export const SectionShiftSchema = z.enum(["MORNING", "AFTERNOON"]);

export const SectionSortFieldSchema = z.enum([
  "grade",
  "trackStrand",
  "sectionName",
  "adviser",
  "room",
  "shift",
]);

export const SectionTableQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  grade: SectionGradeLevelSchema.optional(),
  trackStrand: z.string().trim().min(1).optional(),
  shift: SectionShiftSchema.optional(),
  adviserId: z.string().trim().min(1).optional(),
  sort: SectionSortFieldSchema.optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type SectionTableQueryInput = z.input<typeof SectionTableQuerySchema>;
export type SectionTableQuery = z.output<typeof SectionTableQuerySchema>;

export interface SectionPage {
  items: SectionListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface SectionFilterOptions {
  gradeLevels: string[];
  trackStrands: string[];
  shifts: Array<z.infer<typeof SectionShiftSchema>>;
  advisers: Array<{
    id: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
  }>;
}
