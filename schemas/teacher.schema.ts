import * as z from "zod";

export const CreateTeacherSchema = z.object({
  employeeNumber: z.string().trim().min(1, "Employee number is required."),
  username: z.string().trim().min(1, "Username is required."),
  email: z.string().trim().email("A valid email address is required."),
  temporaryPassword: z
    .string()
    .min(8, "Temporary password must be at least 8 characters."),
  firstName: z.string().trim().min(1, "First name is required."),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, "Last name is required."),
  gender: z.enum(["MALE", "FEMALE"]),
  degree: z.string().trim().optional(),
  major: z.string().trim().optional(),
});

export const UpdateTeacherSchema = z.object({
  employeeNumber: z.string().trim().min(1, "Employee number is required."),
  username: z.string().trim().min(1, "Username is required."),
  email: z.string().trim().email("A valid email address is required."),
  firstName: z.string().trim().min(1, "First name is required."),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1, "Last name is required."),
  gender: z.enum(["MALE", "FEMALE"]),
  degree: z.string().trim().optional(),
  major: z.string().trim().optional(),
});

export const TeacherStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const TeacherGenderSchema = z.enum(["MALE", "FEMALE"]);

export const TeacherSortFieldSchema = z.enum([
  "employeeNumber",
  "lastName",
  "firstName",
  "middleName",
  "gender",
  "degree",
  "major",
  "isAdviser",
  "status",
  "createdAt",
]);

export const TeacherTableQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: TeacherStatusSchema.optional(),
  gender: TeacherGenderSchema.optional(),
  sort: TeacherSortFieldSchema.optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const TeacherListItemSchema = z.object({
  id: z.string(),
  degree: z.string().nullable(),
  major: z.string().nullable(),
  isAdviser: z.boolean(),
  createdAt: z.date(),
  user: z.object({
    employeeNumber: z.string().nullable(),
    username: z.string(),
    email: z.string(),
    firstName: z.string(),
    middleName: z.string().nullable(),
    lastName: z.string(),
    gender: z.enum(["MALE", "FEMALE"]),
    status: z.enum(["ACTIVE", "INACTIVE"]),
  }),
});

export type TeacherListItem = z.infer<typeof TeacherListItemSchema>;
export type TeacherTableQueryInput = z.input<typeof TeacherTableQuerySchema>;
export type TeacherTableQuery = z.output<typeof TeacherTableQuerySchema>;

export interface TeacherPage {
  items: TeacherListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface TeacherFilterOptions {
  statuses: Array<z.infer<typeof TeacherStatusSchema>>;
  genders: Array<z.infer<typeof TeacherGenderSchema>>;
}
