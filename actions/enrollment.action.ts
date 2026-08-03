"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CreateEnrollmentSchema,
  EnrollmentTableQuerySchema,
  UpdateEnrollmentSchema,
  type EnrollmentTableQueryInput,
} from "@/schemas";
import {
  createEnrollmentService,
  EnrollmentServiceError,
  getEnrollmentFilterOptions,
  getEnrollmentFormOptions,
  getEnrollments,
  updateEnrollmentService,
} from "@/services/enrollment.service";
import type { ActionResponse } from "@/types/action-response";

export async function getEnrollmentsAction(query: EnrollmentTableQueryInput) {
  await requirePermission(Permissions.ENROLLMENT);
  const validatedQuery = EnrollmentTableQuerySchema.safeParse(query);

  if (!validatedQuery.success) {
    throw new EnrollmentServiceError("Invalid enrollment query.");
  }

  return await getEnrollments(validatedQuery.data);
}

export async function getEnrollmentFilterOptionsAction() {
  await requirePermission(Permissions.ENROLLMENT);

  return await getEnrollmentFilterOptions();
}

export async function getEnrollmentFormOptionsAction() {
  await requirePermission(Permissions.ENROLLMENT);

  return await getEnrollmentFormOptions();
}

export async function createEnrollmentAction(
  values: z.infer<typeof CreateEnrollmentSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.ENROLLMENT);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedFields = CreateEnrollmentSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await createEnrollmentService(validatedFields.data);

    return {
      success: "Enrollment created successfully.",
    };
  } catch (error) {
    if (error instanceof EnrollmentServiceError) {
      return {
        error: error.message,
      };
    }

    return {
      error: "Something went wrong.",
    };
  }
}

export async function updateEnrollmentAction(
  id: string,
  values: z.infer<typeof UpdateEnrollmentSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.ENROLLMENT);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedId = z.string().min(1).safeParse(id);
  const validatedFields = UpdateEnrollmentSchema.safeParse(values);

  if (!validatedId.success || !validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await updateEnrollmentService(validatedId.data, validatedFields.data);

    return {
      success: "Enrollment updated successfully.",
    };
  } catch (error) {
    if (error instanceof EnrollmentServiceError) {
      return {
        error: error.message,
      };
    }

    return {
      error: "Something went wrong.",
    };
  }
}
