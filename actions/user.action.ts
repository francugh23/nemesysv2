"use server";

import { z } from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CreateUserSchema,
  ChangeUserRoleSchema,
  ChangeUserStatusSchema,
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
  UserAdministrationError,
  changeUserRoleService,
  changeUserStatusService,
  resetUserPasswordService,
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

export async function resetUserPasswordAction(
  id: string,
): Promise<CreateUserActionResponse> {
  try {
    await requirePermission(Permissions.USERS);
  } catch {
    return { error: "Unauthorized." };
  }

  if (!z.string().min(1).safeParse(id).success) {
    return { error: "Invalid user." };
  }

  try {
    const temporaryPassword = await resetUserPasswordService(id);

    return { success: "Password reset successfully.", temporaryPassword };
  } catch (error) {
    if (error instanceof UserAdministrationError) {
      return { error: error.message };
    }

    return { error: "Something went wrong." };
  }
}

export async function changeUserStatusAction(
  id: string,
  status: unknown,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.USERS);
  } catch {
    return { error: "Unauthorized." };
  }

  const validatedId = z.string().min(1).safeParse(id);
  const validatedFields = ChangeUserStatusSchema.safeParse({ status });

  if (!validatedId.success || !validatedFields.success) {
    return { error: "Invalid fields." };
  }

  try {
    await changeUserStatusService(validatedId.data, validatedFields.data.status);

    return { success: `User ${validatedFields.data.status.toLowerCase()}.` };
  } catch (error) {
    if (error instanceof UserAdministrationError) {
      return { error: error.message };
    }

    return { error: "Something went wrong." };
  }
}

export async function changeUserRoleAction(
  id: string,
  role: unknown,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.USERS);
  } catch {
    return { error: "Unauthorized." };
  }

  const validatedId = z.string().min(1).safeParse(id);
  const validatedFields = ChangeUserRoleSchema.safeParse({ role });

  if (!validatedId.success || !validatedFields.success) {
    return { error: "Invalid fields." };
  }

  try {
    await changeUserRoleService(validatedId.data, validatedFields.data.role);

    return { success: "User role updated successfully." };
  } catch (error) {
    if (error instanceof UserAdministrationError) {
      return { error: error.message };
    }

    return { error: "Something went wrong." };
  }
}
