import * as z from "zod";

export const UserRoleSchema = z.enum([
  "SUPER_ADMIN",
  "REGISTRAR",
  "PRINCIPAL",
  "TEACHER",
]);

export const UserStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const CreateUserRoleSchema = z.enum([
  "SUPER_ADMIN",
  "REGISTRAR",
  "PRINCIPAL",
]);

export const UpdateUserRoleSchema = CreateUserRoleSchema;

export const UserGenderSchema = z.enum(["MALE", "FEMALE"]);

export const CreateUserSchema = z.object({
  employeeNumber: z
    .string()
    .trim()
    .min(1, "Employee number is required.")
    .max(100),
  username: z.string().trim().min(1, "Username is required.").max(100),
  email: z
    .string()
    .trim()
    .email("A valid email address is required.")
    .max(254),
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1, "Last name is required.").max(100),
  gender: UserGenderSchema,
  role: CreateUserRoleSchema,
});

export const UpdateUserSchema = CreateUserSchema.omit({ role: true });

export const ChangeUserRoleSchema = z.object({
  role: UpdateUserRoleSchema,
});

export const ChangeUserStatusSchema = z.object({
  status: UserStatusSchema,
});

export const UserFirstLoginFilterSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const UserSortFieldSchema = z.enum([
  "employeeNumber",
  "username",
  "name",
  "role",
  "status",
  "firstLogin",
  "createdAt",
]);

export const UserTableQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: UserRoleSchema.optional(),
  status: UserStatusSchema.optional(),
  firstLogin: UserFirstLoginFilterSchema.optional(),
  sort: UserSortFieldSchema.optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const UserListItemSchema = z.object({
  id: z.string(),
  employeeNumber: z.string().nullable(),
  username: z.string(),
  email: z.string(),
  firstName: z.string(),
  middleName: z.string().nullable(),
  lastName: z.string(),
  gender: UserGenderSchema,
  role: UserRoleSchema,
  status: UserStatusSchema,
  isFirstLogin: z.boolean(),
  isTeacherOwned: z.boolean(),
  createdAt: z.date(),
});

export type UserListItem = z.infer<typeof UserListItemSchema>;
export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type ChangeUserRoleInput = z.infer<typeof ChangeUserRoleSchema>;
export type ChangeUserStatusInput = z.infer<typeof ChangeUserStatusSchema>;
export type UserTableQueryInput = z.input<typeof UserTableQuerySchema>;
export type UserTableQuery = z.output<typeof UserTableQuerySchema>;

export interface UserPage {
  items: UserListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export interface UserFilterOptions {
  roles: Array<z.infer<typeof UserRoleSchema>>;
  statuses: Array<z.infer<typeof UserStatusSchema>>;
  firstLoginValues: boolean[];
}
