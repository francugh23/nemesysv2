"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  UserTableQuerySchema,
  type UserTableQueryInput,
} from "@/schemas";
import { getUserFilterOptions, getUsers } from "@/services/user.service";

export async function getUsersAction(query: UserTableQueryInput) {
  await requirePermission(Permissions.USERS);
  const validatedQuery = UserTableQuerySchema.safeParse(query);

  if (!validatedQuery.success) {
    throw new Error("Invalid user query.");
  }

  return await getUsers(validatedQuery.data);
}

export async function getUserFilterOptionsAction() {
  await requirePermission(Permissions.USERS);

  return await getUserFilterOptions();
}
