"use server";

import * as z from "zod";

import { auth } from "@/auth";
import { CreateSectionSchema } from "@/schemas";
import {
  createSectionService,
  getSectionFormOptions,
  getSections,
} from "@/services/section.service";
import { ActionResponse } from "@/types/action-response";

async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized.");
  }
}

export async function getSectionsAction() {
  await requireSuperAdmin();

  return await getSections();
}

export async function getSectionFormOptionsAction() {
  await requireSuperAdmin();

  return await getSectionFormOptions();
}

export async function createSectionAction(
  values: z.infer<typeof CreateSectionSchema>,
): Promise<ActionResponse> {
  try {
    await requireSuperAdmin();
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedFields = CreateSectionSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await createSectionService(validatedFields.data);

    return {
      success: "Section created successfully.",
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
