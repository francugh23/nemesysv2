"use server";

import { z } from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserTableQuerySchema,
  type CreateUserInput,
  type UpdateUserInput,
  type UserTableQueryInput,
} from "@/schemas";
import {
  createUserService,
  getUserFilterOptions,
  getUsers,
  UserCreationError,
  UserUpdateError,
  updateUserService,
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

export async function updateUserAction(
  id: string,
  values: UpdateUserInput,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.USERS);
  } catch {
    return { error: "Unauthorized." };
  }

  const validatedId = z.string().min(1).safeParse(id);
  const validatedFields = UpdateUserSchema.safeParse(values);

  if (!validatedId.success || !validatedFields.success) {
    return { error: "Invalid fields." };
  }

  try {
    await updateUserService(validatedId.data, validatedFields.data);

    return { success: "User updated successfully." };
  } catch (error) {
    if (error instanceof UserUpdateError) {
      return { error: error.message };
    }

    return { error: "Something went wrong." };
  }
}
