"use server";

import * as z from "zod";

import { CreateSubjectSchema } from "@/schemas";
import {
  createSubjectService,
  getSubjects,
} from "@/services/subject.service";
import { ActionResponse } from "@/types/action-response";

export async function getSubjectsAction() {
  return await getSubjects();
}

export async function createSubjectAction(
  values: z.infer<typeof CreateSubjectSchema>,
): Promise<ActionResponse> {
  const validatedFields = CreateSubjectSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await createSubjectService(validatedFields.data);

    return {
      success: "Subject created successfully.",
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
