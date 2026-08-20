import * as z from "zod";

export const ACADEMIC_YEAR_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "LOCKED",
  "ARCHIVED",
] as const;

export const AcademicYearStatusSchema = z.enum(ACADEMIC_YEAR_STATUSES);

export const AcademicYearDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);

    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Date must be a valid calendar date.");

const AcademicYearFieldsSchema = z
  .object({
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

    const startYear = Number(values.startDate.slice(0, 4));
    const endYear = Number(values.endDate.slice(0, 4));

    if (endYear !== startYear + 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date must be in the calendar year after the start date.",
      });
    }
  });

export const CreateAcademicYearSchema = AcademicYearFieldsSchema;
export const UpdateAcademicYearSchema = AcademicYearFieldsSchema;

export type CreateAcademicYearInput = z.infer<typeof CreateAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof UpdateAcademicYearSchema>;

export const AcademicYearSortFieldSchema = z.enum([
  "label",
  "startDate",
  "endDate",
  "status",
]);

export const AcademicYearTableQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: AcademicYearStatusSchema.optional(),
  sort: AcademicYearSortFieldSchema.optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type AcademicYearTableQueryInput = z.input<
  typeof AcademicYearTableQuerySchema
>;
export type AcademicYearTableQuery = z.output<
  typeof AcademicYearTableQuerySchema
>;

export const AcademicYearListItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  status: AcademicYearStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
  curriculumFinalization: z.object({ finalizedAt: z.date() }).nullable(),
});

export type AcademicYearListItem = z.infer<typeof AcademicYearListItemSchema>;

export const AcademicYearConfigurationSummaryReadSchema = z.object({
  academicYearId: z.string().min(1),
});

export type AcademicYearConfigurationSummaryReadInput = z.infer<
  typeof AcademicYearConfigurationSummaryReadSchema
>;

export interface AcademicYearPage {
  items: AcademicYearListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface AcademicYearFilterOptions {
  statuses: Array<z.infer<typeof AcademicYearStatusSchema>>;
}
