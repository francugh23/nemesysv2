import * as z from "zod";

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
