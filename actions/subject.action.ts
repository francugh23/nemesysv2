"use server";

import * as z from "zod";

import { CreateSubjectSchema, UpdateSubjectSchema } from "@/schemas";
import {
  archiveSubjectService,
  createSubjectService,
  getSubjects,
  updateSubjectService,
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

export async function updateSubjectAction(
  id: string,
  values: z.infer<typeof UpdateSubjectSchema>,
): Promise<ActionResponse> {
  const validatedFields = UpdateSubjectSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await updateSubjectService(id, validatedFields.data);

    return {
      success: "Subject updated successfully.",
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

export async function archiveSubjectAction(id: string): Promise<ActionResponse> {
  try {
    await archiveSubjectService(id);

    return {
      success: "Subject archived successfully.",
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
