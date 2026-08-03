"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CreateSubjectSchema,
  SubjectTableQuerySchema,
  type SubjectTableQueryInput,
  UpdateSubjectSchema,
} from "@/schemas";
import {
  archiveSubjectService,
  createSubjectService,
  getSubjectFilterOptions,
  getSubjects,
  updateSubjectService,
} from "@/services/subject.service";
import { ActionResponse } from "@/types/action-response";

export async function getSubjectsAction(query: SubjectTableQueryInput) {
  await requirePermission(Permissions.SUBJECTS);
  const validatedQuery = SubjectTableQuerySchema.safeParse(query);

  if (!validatedQuery.success) {
    throw new Error("Invalid subject query.");
  }

  return await getSubjects(validatedQuery.data);
}

export async function getSubjectFilterOptionsAction() {
  await requirePermission(Permissions.SUBJECTS);

  return await getSubjectFilterOptions();
}

export async function createSubjectAction(
  values: z.infer<typeof CreateSubjectSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.SUBJECTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

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
  try {
    await requirePermission(Permissions.SUBJECTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

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
    await requirePermission(Permissions.SUBJECTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

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
