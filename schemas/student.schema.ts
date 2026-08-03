import * as z from "zod";

export const CreateStudentSchema = z.object({
  lrn: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "LRN must contain exactly 12 digits."),

  firstName: z.string().min(1, "First name is required."),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required."),
  gender: z.enum(["MALE", "FEMALE"]),
  dateOfBirth: z.date().optional(),
  purok: z.string().optional(),
  barangay: z.string().min(1, "Barangay is required."),
  municipality: z.string().min(1, "Municipality is required."),
  province: z.string().min(1, "Province is required."),
  zipCode: z.string().optional(),
  fatherName: z.string().optional(),
  fatherContact: z.string().optional(),
  motherName: z.string().optional(),
  motherContact: z.string().optional(),
  guardianName: z.string().optional(),
  guardianContact: z.string().optional(),
});

export const StudentStatusSchema = z.enum([
  "UNENROLLED",
  "ENROLLED",
  "GRADUATED",
  "TRANSFERRED",
  "DROPPED",
]);

export const StudentGenderSchema = z.enum(["MALE", "FEMALE"]);

export const StudentSortFieldSchema = z.enum([
  "lrn",
  "name",
  "gender",
  "status",
  "grade",
  "currentSection",
  "createdAt",
]);

export const StudentTableQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: StudentStatusSchema.optional(),
  gender: StudentGenderSchema.optional(),
  grade: z.string().trim().min(1).optional(),
  sectionId: z.string().trim().min(1).optional(),
  sort: StudentSortFieldSchema.optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type StudentTableQueryInput = z.input<typeof StudentTableQuerySchema>;
export type StudentTableQuery = z.output<typeof StudentTableQuerySchema>;
