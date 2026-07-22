"use server";

import * as z from "zod";

import { CreateStudentSchema } from "@/schemas";
import {
  createStudentService,
  getStudents,
  updateStudentService,
  deleteStudentService,
} from "@/services/student.service";
import { ActionResponse } from "@/types/action-response";

export async function getStudentsAction() {
  return await getStudents();
}

export async function createStudentAction(
  values: z.infer<typeof CreateStudentSchema>,
): Promise<ActionResponse> {
  const validatedFields = CreateStudentSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await createStudentService(validatedFields.data);

    return {
      success: "Student created successfully.",
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

export async function updateStudentAction(
  id: string,
  values: z.infer<typeof CreateStudentSchema>,
): Promise<ActionResponse> {
  const validatedFields = CreateStudentSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await updateStudentService(id, validatedFields.data);

    return {
      success: "Student updated successfully.",
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

export async function deleteStudentAction(id: string): Promise<ActionResponse> {
  try {
    await deleteStudentService(id);

    return {
      success: "Student deleted successfully.",
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