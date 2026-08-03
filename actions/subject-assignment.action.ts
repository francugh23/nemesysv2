"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CreateSubjectAssignmentSchema,
  UpdateSubjectAssignmentSchema,
} from "@/schemas";
import {
  archiveSubjectAssignmentService,
  createSubjectAssignmentService,
  getSubjectAssignmentOptions,
  getSubjectAssignments,
  updateSubjectAssignmentService,
} from "@/services/subject-assignment.service";
import { ActionResponse } from "@/types/action-response";

export async function getSubjectAssignmentsAction() {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);

  return await getSubjectAssignments();
}

export async function getSubjectAssignmentOptionsAction() {
  await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);

  return await getSubjectAssignmentOptions();
}

export async function createSubjectAssignmentAction(
  values: z.infer<typeof CreateSubjectAssignmentSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

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

export async function updateSubjectAssignmentAction(
  id: string,
  values: z.infer<typeof UpdateSubjectAssignmentSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedId = z.string().min(1).safeParse(id);
  const validatedFields = UpdateSubjectAssignmentSchema.safeParse(values);

  if (!validatedId.success || !validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await updateSubjectAssignmentService(validatedId.data, validatedFields.data);

    return {
      success: "Subject assignment updated successfully.",
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

export async function archiveSubjectAssignmentAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.SUBJECT_ASSIGNMENTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedId = z.string().min(1).safeParse(id);

  if (!validatedId.success) {
    return {
      error: "Invalid subject assignment.",
    };
  }

  try {
    await archiveSubjectAssignmentService(validatedId.data);

    return {
      success: "Subject assignment archived successfully.",
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
