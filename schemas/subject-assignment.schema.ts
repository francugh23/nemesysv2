import * as z from "zod";

const SubjectAssignmentFieldsSchema = z.object({
  teacherId: z.string().min(1, "Teacher is required."),
  subjectOfferingId: z.string().min(1, "Curriculum Offering is required."),
  academicTermId: z.string().min(1, "Academic Term is required."),
  sectionId: z.string().min(1, "Section is required."),
});

export const CreateSubjectAssignmentSchema = SubjectAssignmentFieldsSchema;
export const UpdateSubjectAssignmentSchema = SubjectAssignmentFieldsSchema;

export const AssignmentMatrixQuerySchema = z.object({
  academicYearId: z.string().min(1).optional(),
  gradeLevel: z.enum(["7", "8", "9", "10", "11", "12"]),
});

export const AssignmentMatrixScopeSchema = z.object({
  subjectOfferingId: z.string().min(1),
  academicTermId: z.string().min(1),
  sectionId: z.string().min(1),
  expectedAssignmentId: z.string().min(1).nullable(),
});

const MatrixMutationBaseSchema = z.object({
  academicYearId: z.string().min(1),
  gradeLevel: z.enum(["7", "8", "9", "10", "11", "12"]),
});

export const MatrixAssignSchema = MatrixMutationBaseSchema.extend({
  action: z.literal("ASSIGN"),
  teacherId: z.string().min(1, "Teacher is required."),
  scopes: z.array(AssignmentMatrixScopeSchema).min(1),
});

export const MatrixClearSchema = MatrixMutationBaseSchema.extend({
  action: z.literal("CLEAR"),
  scopes: z.array(AssignmentMatrixScopeSchema).min(1),
});

export const MatrixCopySchema = MatrixMutationBaseSchema.extend({
  action: z.literal("COPY"),
  sourceScopes: z.array(AssignmentMatrixScopeSchema).min(1),
  destinationScopes: z.array(AssignmentMatrixScopeSchema).min(1),
});

export const AssignmentMatrixMutationSchema = z.discriminatedUnion("action", [
  MatrixAssignSchema,
  MatrixClearSchema,
  MatrixCopySchema,
]);

export type AssignmentMatrixMutation = z.infer<
  typeof AssignmentMatrixMutationSchema
>;

export type AssignmentMatrixQuery = z.output<typeof AssignmentMatrixQuerySchema>;

export const SubjectAssignmentHistoryStatusSchema = z.enum([
  "ACTIVE",
  "ARCHIVED",
]);

export const SubjectAssignmentHistoryQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: SubjectAssignmentHistoryStatusSchema.optional(),
  academicYearId: z.string().cuid().optional(),
  academicTermId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().refine((value) => value === 25 || value === 50, {
    message: "Page size must be 25 or 50.",
  }).default(25),
});

export const SubjectAssignmentHistoryFilterOptionsQuerySchema = z.object({
  academicYearId: z.string().cuid().optional(),
});

export const SubjectAssignmentHistoryItemSchema = z.object({
  id: z.string(),
  status: SubjectAssignmentHistoryStatusSchema,
  academicYear: z.object({ id: z.string(), label: z.string() }),
  term: z.object({ id: z.string(), name: z.string(), position: z.number() }),
  offering: z.object({
    id: z.string(),
    subjectCode: z.string(),
    subjectDescription: z.string(),
    gradeLevel: z.string(),
  }),
  section: z.object({ id: z.string(), sectionName: z.string(), gradeLevel: z.string() }),
  teacher: z.object({
    id: z.string(),
    employeeNumber: z.string().nullable(),
    name: z.string(),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullable(),
  changedAt: z.date(),
});

export type SubjectAssignmentHistoryQueryInput = z.input<
  typeof SubjectAssignmentHistoryQuerySchema
>;
export type SubjectAssignmentHistoryQuery = z.output<
  typeof SubjectAssignmentHistoryQuerySchema
>;
export type SubjectAssignmentHistoryItem = z.infer<
  typeof SubjectAssignmentHistoryItemSchema
>;
export interface SubjectAssignmentHistoryPage {
  items: SubjectAssignmentHistoryItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const SubjectAssignmentListItemSchema = z.object({
  id: z.string(),
  teacherId: z.string(),
  subjectOfferingId: z.string(),
  academicTermId: z.string(),
  sectionId: z.string(),
  employeeNumber: z.string().nullable(),
  teacherFirstName: z.string(),
  teacherMiddleName: z.string().nullable(),
  teacherLastName: z.string(),
  subjectOfferingCode: z.string(),
  subjectOfferingDescription: z.string(),
  academicTermName: z.string(),
  academicTermPosition: z.number(),
  sectionGradeLevel: z.string(),
  sectionName: z.string(),
  academicYearLabel: z.string(),
  academicYearStatus: z.enum(["DRAFT", "ACTIVE", "LOCKED", "ARCHIVED"]),
});

export type SubjectAssignmentListItem = z.infer<
  typeof SubjectAssignmentListItemSchema
>;
