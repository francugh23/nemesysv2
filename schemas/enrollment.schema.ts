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

export const CorrectStudentEnrollmentPlacementSchema = z.object({
  sourceSectionId: z.string().min(1, "Source Section is required."),
  destinationSectionId: z.string().min(1, "Destination Section is required."),
  reason: z.string().trim().min(1, "Reason is required.").max(500),
  evidenceReference: z.string().trim().min(1, "Evidence/reference is required.").max(500),
  confirmed: z.boolean().refine((value) => value, "Confirm the historical correction."),
});

export type CorrectStudentEnrollmentPlacementInput = z.infer<
  typeof CorrectStudentEnrollmentPlacementSchema
>;

export const CorrectStudentEnrollmentGradePlacementSchema = z.object({
  sourceSectionId: z.string().min(1, "Source Section is required."),
  destinationSectionId: z.string().min(1, "Destination Section is required."),
  reason: z.string().trim().min(1, "Reason is required.").max(500),
  evidenceReference: z.string().trim().min(1, "Evidence/reference is required.").max(500),
  confirmed: z.boolean().refine((value) => value, "Confirm the historical correction."),
  typedConfirmation: z.string().optional(),
});

export type CorrectStudentEnrollmentGradePlacementInput = z.infer<
  typeof CorrectStudentEnrollmentGradePlacementSchema
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

export interface StudentEnrollmentCorrectionHistoryItem {
  id: string;
  correctionType: "PLACEMENT" | "GRADE_LEVEL";
  sourceSection: string;
  destinationSection: string;
  correctedBy: string;
  correctedAt: Date;
  reason: string;
  evidenceReference: string;
  sourceParticipationCount?: number;
  replacementParticipationCount?: number;
}

export interface StudentEnrollmentCorrectionContext {
  enrollmentId: string;
  gradeLevel: string;
  currentSectionId: string;
  currentSection: string;
  participationCount: number;
  destinations: Array<{
    id: string;
    gradeLevel: string;
    sectionName: string;
  }>;
  history: StudentEnrollmentCorrectionHistoryItem[];
}

export interface StudentEnrollmentGradeCorrectionSubjectPreview {
  subjectCode: string;
  subjectDescription: string;
  gradeLevel: string;
  termNames: string[];
  resultBlockers: string[];
}

export interface StudentEnrollmentGradeCorrectionPreview {
  enrollmentId: string;
  sourceSectionId: string;
  destinationSectionId: string;
  sourceGradeLevel: string;
  destinationGradeLevel: string;
  eligible: boolean;
  blockers: string[];
  resultBlockers: Array<{
    studentSubjectEnrollmentId: string;
    subjectCode: string;
    resultCount: number;
  }>;
  sourceSubjects: StudentEnrollmentGradeCorrectionSubjectPreview[];
  destinationSubjects: StudentEnrollmentGradeCorrectionSubjectPreview[];
  requiresTypedConfirmation: boolean;
  typedConfirmationPhrase: string;
}

// Retained only for the legacy Semester-retirement contract. Operational
// placement correction uses CorrectStudentEnrollmentPlacementSchema.
export const UpdateEnrollmentSchema = z.object({
  sectionId: z.string().min(1, "Section is required."),
});
export type UpdateEnrollmentInput = z.infer<typeof UpdateEnrollmentSchema>;

export const EnrollmentSortFieldSchema = z.enum([
  "studentLrn",
  "studentName",
  "sectionGradeLevel",
  "sectionName",
  "academicYear",
  "status",
]);

export const EnrollmentTableQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: EnrollmentStatusSchema.optional(),
  gradeLevel: z.string().trim().min(1).optional(),
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
  sections: Array<{
    id: string;
    gradeLevel: string;
    sectionName: string;
  }>;
}
