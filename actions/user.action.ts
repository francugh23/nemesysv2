"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CreateUserSchema,
  UserTableQuerySchema,
  type CreateUserInput,
  type UserTableQueryInput,
} from "@/schemas";
import {
  createUserService,
  getUserFilterOptions,
  getUsers,
  UserCreationError,
} from "@/services/user.service";
import type { ActionResponse } from "@/types/action-response";

type CreateUserActionResponse = ActionResponse & {
  temporaryPassword?: string;
};

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

export async function createUserAction(
  values: CreateUserInput,
): Promise<CreateUserActionResponse> {
  try {
    await requirePermission(Permissions.USERS);
  } catch {
    return { error: "Unauthorized." };
  }

  const validatedFields = CreateUserSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: "Invalid fields." };
  }

  try {
    const temporaryPassword = await createUserService(validatedFields.data);

    return {
      success: "User created successfully.",
      temporaryPassword,
    };
  } catch (error) {
    if (error instanceof UserCreationError) {
      return { error: error.message };
    }

    return { error: "Something went wrong." };
  }
}
