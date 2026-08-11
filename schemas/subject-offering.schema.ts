import * as z from "zod";

export const SubjectOfferingFieldsSchema = z.object({
  subjectId: z.string().min(1),
  academicYearId: z.string().min(1),
  gradeLevel: z.enum(["7", "8", "9", "10", "11", "12"]),
  academicTermIds: z.array(z.string().min(1)).min(1),
});
export const CreateSubjectOfferingSchema = SubjectOfferingFieldsSchema;
export const UpdateSubjectOfferingSchema = SubjectOfferingFieldsSchema;
export type CreateSubjectOfferingInput = z.infer<typeof CreateSubjectOfferingSchema>;
export type UpdateSubjectOfferingInput = z.infer<typeof UpdateSubjectOfferingSchema>;
export const SubjectOfferingTableQuerySchema = z.object({
  academicYearId: z.string().optional(), gradeLevel: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type SubjectOfferingTableQueryInput = z.input<typeof SubjectOfferingTableQuerySchema>;
export type SubjectOfferingTableQuery = z.output<typeof SubjectOfferingTableQuerySchema>;
