import * as z from "zod";

import { SUBJECT_GRADE_LEVELS, isJhsGradeLevel } from "@/lib/subject-identity";

export const ShsSubjectClassificationSchema = z.enum([
  "CORE",
  "ACADEMIC_ELECTIVE",
  "TECHPRO_ELECTIVE",
]);
export const ShsCurriculumStatusSchema = z.enum([
  "PROVISIONAL_DEPED",
  "SCHOOL_APPROVED",
]);
export const ShsCurriculumClusterTrackSchema = z.enum(["ACADEMIC", "TECHPRO"]);

export const SubjectOfferingShsContextSchema = z
  .object({
    classification: ShsSubjectClassificationSchema,
    curriculumStatus: z.literal("PROVISIONAL_DEPED"),
    clusterId: z.string().trim().min(1).optional(),
    sourceReference: z.string().trim().min(1).max(500).optional(),
    approvalReference: z.string().trim().min(1).max(500).optional(),
  })
  .superRefine((values, context) => {
    if (values.classification === "CORE" && values.clusterId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["clusterId"], message: "Core subjects cannot have a curriculum cluster." });
    }
    if (values.classification !== "CORE" && !values.clusterId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["clusterId"], message: "Electives require a curriculum cluster." });
    }
    if (values.curriculumStatus === "PROVISIONAL_DEPED" && !values.sourceReference) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["sourceReference"], message: "SHS Curriculum requires a source / provenance reference before school approval." });
    }
    if (values.approvalReference) context.addIssue({ code: z.ZodIssueCode.custom, path: ["approvalReference"], message: "School approval uses the controlled approval workflow." });
  });

export const SubjectOfferingFieldsSchema = z
  .object({
    subjectId: z.string().min(1),
    academicYearId: z.string().min(1),
    gradeLevel: z.enum(SUBJECT_GRADE_LEVELS),
    academicTermIds: z.array(z.string().min(1)).min(1),
    shsContext: SubjectOfferingShsContextSchema.optional(),
  })
  .superRefine((values, context) => {
    if (isJhsGradeLevel(values.gradeLevel) && values.shsContext) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["shsContext"], message: "SHS context is only valid for Grades 11 and 12." });
    }
    if (!isJhsGradeLevel(values.gradeLevel) && !values.shsContext) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["shsContext"], message: "Grades 11 and 12 offerings require SSHS context." });
    }
  });

export const CreateSubjectOfferingSchema = SubjectOfferingFieldsSchema;
export const UpdateSubjectOfferingSchema = SubjectOfferingFieldsSchema;
export type CreateSubjectOfferingInput = z.infer<typeof CreateSubjectOfferingSchema>;
export type UpdateSubjectOfferingInput = z.infer<typeof UpdateSubjectOfferingSchema>;

export const PromoteShsSubjectOfferingSchema = z.object({
  subjectOfferingId: z.string().min(1),
  approvalReference: z.string().trim().min(1).max(500),
});
export type PromoteShsSubjectOfferingInput = z.infer<typeof PromoteShsSubjectOfferingSchema>;

export const ShsCurriculumClusterFieldsSchema = z.object({
  code: z.string().trim().min(1).max(50).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(150),
  track: ShsCurriculumClusterTrackSchema,
});
export const CreateShsCurriculumClusterSchema = ShsCurriculumClusterFieldsSchema;
export const UpdateShsCurriculumClusterSchema = ShsCurriculumClusterFieldsSchema;
export type CreateShsCurriculumClusterInput = z.infer<typeof CreateShsCurriculumClusterSchema>;
export type UpdateShsCurriculumClusterInput = z.infer<typeof UpdateShsCurriculumClusterSchema>;

export const SubjectOfferingTableQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  academicYearId: z.string().trim().min(1).optional(),
  gradeLevel: z.enum(SUBJECT_GRADE_LEVELS).optional(),
  curriculumStatus: ShsCurriculumStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type SubjectOfferingTableQueryInput = z.input<typeof SubjectOfferingTableQuerySchema>;
export type SubjectOfferingTableQuery = z.output<typeof SubjectOfferingTableQuerySchema>;
