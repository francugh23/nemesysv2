import * as z from "zod";

export const CreateEnrollmentSchema = z.object({
  studentId: z.string().min(1, "Student is required."),
  sectionId: z.string().min(1, "Section is required."),
  academicYearId: z.string().min(1, "Academic year is required."),
  entryAcademicTermId: z.string().min(1, "Entry Academic Term is required.").optional(),
  shsTrack: z.enum(["ACADEMIC", "TECHPRO"]).optional(),
});

export type CreateEnrollmentInput = z.infer<typeof CreateEnrollmentSchema>;

export const EnrollmentStatusSchema = z.enum([
  "ACTIVE",
  "COMPLETED",
  "DROPPED",
  "TRANSFERRED",
]);

export const CorrectEnrollmentPlacementSchema = z.object({
  sectionId: z.string().min(1, "Section is required."),
});

export type CorrectEnrollmentPlacementInput = z.infer<
  typeof CorrectEnrollmentPlacementSchema
>;

export const EnrollmentTerminalStatusSchema = z.enum([
  "COMPLETED",
  "DROPPED",
  "TRANSFERRED",
]);

export const TransitionEnrollmentSchema = z.object({
  status: EnrollmentTerminalStatusSchema,
});

export type TransitionEnrollmentInput = z.infer<
  typeof TransitionEnrollmentSchema
>;

// Retained for the legacy Semester-retirement contract; lifecycle writes use the
// explicitly named placement and transition schemas above.
export const UpdateEnrollmentSchema = CorrectEnrollmentPlacementSchema;
export type UpdateEnrollmentInput = CorrectEnrollmentPlacementInput;

export const EnrollmentSortFieldSchema = z.enum([
  "studentLrn",
  "studentName",
  "sectionGradeLevel",
  "sectionTrackStrand",
  "sectionName",
  "academicYear",
  "status",
]);

export const EnrollmentTableQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: EnrollmentStatusSchema.optional(),
  gradeLevel: z.string().trim().min(1).optional(),
  trackStrand: z.string().trim().min(1).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  sectionId: z.string().trim().min(1).optional(),
  sort: EnrollmentSortFieldSchema.optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type EnrollmentTableQueryInput = z.input<
  typeof EnrollmentTableQuerySchema
>;
export type EnrollmentTableQuery = z.output<typeof EnrollmentTableQuerySchema>;

export const EnrollmentListItemSchema = z.object({
  id: z.string(),
  studentId: z.string(),
  sectionId: z.string(),
  academicYearId: z.string(),
  shsTrack: z.enum(["ACADEMIC", "TECHPRO"]).nullable(),
  entryAcademicTermId: z.string().nullable(),
  entryAcademicTermName: z.string().nullable(),
  entryAcademicTermPosition: z.number().int().nullable(),
  studentLrn: z.string(),
  studentFirstName: z.string(),
  studentMiddleName: z.string().nullable(),
  studentLastName: z.string(),
  sectionGradeLevel: z.string(),
  sectionTrackStrand: z.string().nullable(),
  sectionName: z.string(),
  academicYear: z.string(),
  academicYearStatus: z.enum(["DRAFT", "ACTIVE", "LOCKED", "ARCHIVED"]),
  status: EnrollmentStatusSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EnrollmentListItem = z.infer<typeof EnrollmentListItemSchema>;

export interface EnrollmentPage {
  items: EnrollmentListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface EnrollmentFilterOptions {
  academicYears: Array<{
    id: string;
    label: string;
  }>;
  gradeLevels: string[];
  trackStrands: string[];
  sections: Array<{
    id: string;
    gradeLevel: string;
    trackStrand: string | null;
    sectionName: string;
  }>;
}
