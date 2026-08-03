"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import { CreateTeacherSchema, UpdateTeacherSchema } from "@/schemas";
import {
  createTeacherService,
  deactivateTeacherService,
  getTeachers,
  updateTeacherService,
} from "@/services/teacher.service";
import { ActionResponse } from "@/types/action-response";

export async function getTeachersAction() {
  await requirePermission(Permissions.TEACHERS);

  return await getTeachers();
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
