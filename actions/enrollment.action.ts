"use server";

import * as z from "zod";

import { auth } from "@/auth";
import { CreateEnrollmentSchema } from "@/schemas";
import {
  createEnrollmentService,
  EnrollmentServiceError,
  getEnrollmentFormOptions,
  getEnrollments,
} from "@/services/enrollment.service";
import type { ActionResponse } from "@/types/action-response";

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized.");
  }
}

export async function getEnrollmentsAction() {
  await requireSuperAdmin();

  return await getEnrollments();
}

export async function getEnrollmentFormOptionsAction() {
  await requireSuperAdmin();

  return await getEnrollmentFormOptions();
}

export async function createEnrollmentAction(
  values: z.infer<typeof CreateEnrollmentSchema>,
): Promise<ActionResponse> {
  try {
    await requireSuperAdmin();
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
