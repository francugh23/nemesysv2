import * as z from "zod";

export const UserRoleSchema = z.enum([
  "SUPER_ADMIN",
  "REGISTRAR",
  "PRINCIPAL",
  "TEACHER",
]);

export const UserStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

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
  role: UserRoleSchema,
  status: UserStatusSchema,
  isFirstLogin: z.boolean(),
  createdAt: z.date(),
});

export type UserListItem = z.infer<typeof UserListItemSchema>;
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
