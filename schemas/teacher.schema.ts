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

export const TeacherListItemSchema = z.object({
  id: z.string(),
  degree: z.string().nullable(),
  major: z.string().nullable(),
  isAdviser: z.boolean(),
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
