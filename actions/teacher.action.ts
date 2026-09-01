"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CreateTeacherSchema,
  TeacherTableQuerySchema,
  type TeacherTableQueryInput,
  UpdateTeacherSchema,
} from "@/schemas";
import {
  createTeacherService,
  archiveTeacherService,
  deactivateTeacherService,
  getTeacherFilterOptions,
  getTeachers,
  updateTeacherService,
} from "@/services/teacher.service";
import { ActionResponse } from "@/types/action-response";

export async function getTeachersAction(query: TeacherTableQueryInput) {
  await requirePermission(Permissions.TEACHERS);
  const validatedQuery = TeacherTableQuerySchema.safeParse(query);

  if (!validatedQuery.success) {
    throw new Error("Invalid teacher query.");
  }

  return await getTeachers(validatedQuery.data);
}

export async function getTeacherFilterOptionsAction() {
  await requirePermission(Permissions.TEACHERS);

  return await getTeacherFilterOptions();
}

export async function createTeacherAction(
  values: z.infer<typeof CreateTeacherSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.TEACHERS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedFields = CreateTeacherSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await createTeacherService(validatedFields.data);

    return {
      success: "Teacher created successfully.",
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      };
    }

    return {
      error: "Something went wrong.",
    };
  }
}

export async function updateTeacherAction(
  id: string,
  values: z.infer<typeof UpdateTeacherSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.TEACHERS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedFields = UpdateTeacherSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await updateTeacherService(id, validatedFields.data);

    return {
      success: "Teacher updated successfully.",
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      };
    }

    return {
      error: "Something went wrong.",
    };
  }
}

export async function deactivateTeacherAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.TEACHERS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  try {
    await deactivateTeacherService(id);

    return {
      success: "Teacher deactivated successfully.",
    };
  } catch (error) {
    if (error instanceof Error) {
      return {
        error: error.message,
      };
    }

    return {
      error: "Something went wrong.",
    };
  }
}

export async function archiveTeacherAction(id: string): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.TEACHERS);
  } catch {
    return { error: "Unauthorized." };
  }

  try {
    await archiveTeacherService(id);
    return { success: "Teacher archived successfully." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
