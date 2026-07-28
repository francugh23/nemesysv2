"use server";

import * as z from "zod";

import { CreateTeacherSchema } from "@/schemas";
import {
  createTeacherService,
  getTeachers,
} from "@/services/teacher.service";
import { ActionResponse } from "@/types/action-response";

export async function getTeachersAction() {
  return await getTeachers();
}

export async function createTeacherAction(
  values: z.infer<typeof CreateTeacherSchema>,
): Promise<ActionResponse> {
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
