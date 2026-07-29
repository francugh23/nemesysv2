"use server";

import * as z from "zod";

import { auth } from "@/auth";
import { CreateSectionSchema, UpdateSectionSchema } from "@/schemas";
import {
  archiveSectionService,
  createSectionService,
  getSectionFormOptions,
  getSections,
  updateSectionService,
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

export async function updateSectionAction(
  id: string,
  values: z.infer<typeof UpdateSectionSchema>,
): Promise<ActionResponse> {
  try {
    await requireSuperAdmin();
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedId = z.string().min(1).safeParse(id);
  const validatedFields = UpdateSectionSchema.safeParse(values);

  if (!validatedId.success || !validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await updateSectionService(validatedId.data, validatedFields.data);

    return {
      success: "Section updated successfully.",
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

export async function archiveSectionAction(
  id: string,
): Promise<ActionResponse> {
  try {
    await requireSuperAdmin();
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedId = z.string().min(1).safeParse(id);

  if (!validatedId.success) {
    return {
      error: "Invalid section.",
    };
  }

  try {
    await archiveSectionService(validatedId.data);

    return {
      success: "Section archived successfully.",
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
