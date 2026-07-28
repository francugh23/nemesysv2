"use server";

import * as z from "zod";

import { CreateSubjectAssignmentSchema } from "@/schemas";
import {
  createSubjectAssignmentService,
  getSubjectAssignmentOptions,
  getSubjectAssignments,
} from "@/services/subject-assignment.service";
import { ActionResponse } from "@/types/action-response";

export async function getSubjectAssignmentsAction() {
  return await getSubjectAssignments();
}

export async function getSubjectAssignmentOptionsAction() {
  return await getSubjectAssignmentOptions();
}

export async function createSubjectAssignmentAction(
  values: z.infer<typeof CreateSubjectAssignmentSchema>,
): Promise<ActionResponse> {
  const validatedFields = CreateSubjectAssignmentSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await createSubjectAssignmentService(validatedFields.data);

    return {
      success: "Subject assignment created successfully.",
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
