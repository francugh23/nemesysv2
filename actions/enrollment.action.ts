"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import { CreateEnrollmentSchema } from "@/schemas";
import {
  createEnrollmentService,
  EnrollmentServiceError,
  getEnrollmentFormOptions,
  getEnrollments,
} from "@/services/enrollment.service";
import type { ActionResponse } from "@/types/action-response";

export async function getEnrollmentsAction() {
  await requirePermission(Permissions.ENROLLMENT);

  return await getEnrollments();
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
