"use server";

import * as z from "zod";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CreateStudentSchema,
  ExportFormatSchema,
  type StudentTableQueryInput,
  validateStudentTableQuery,
} from "@/schemas";
import {
  createStudentService,
  getStudentFilterOptions,
  getStudents,
  updateStudentService,
  deleteStudentService,
  exportStudents,
} from "@/services/student.service";
import { ActionResponse } from "@/types/action-response";
import type { ExportActionResult, ExportFormat } from "@/types/export";
import { ExportError } from "@/services/export.service";

export async function getStudentsAction(query: StudentTableQueryInput) {
  await requirePermission(Permissions.STUDENTS);
  const validatedQuery = validateStudentTableQuery(query);

  if (!validatedQuery.success) {
    throw new Error("Invalid student query.");
  }

  return await getStudents(validatedQuery.data);
}

export async function exportStudentsAction(
  query: StudentTableQueryInput,
  format: ExportFormat,
): Promise<ExportActionResult> {
  try {
    await requirePermission(Permissions.STUDENTS);
  } catch {
    return { error: "Unauthorized." };
  }

  const validatedQuery = validateStudentTableQuery(query);
  const validatedFormat = ExportFormatSchema.safeParse(format);

  if (!validatedQuery.success || !validatedFormat.success) {
    return { error: "Invalid export request." };
  }

  try {
    return {
      file: await exportStudents(validatedQuery.data, validatedFormat.data),
    };
  } catch (error) {
    return {
      error:
        error instanceof ExportError
          ? error.message
          : "Unable to export student records.",
    };
  }
}

export async function getStudentFilterOptionsAction() {
  await requirePermission(Permissions.STUDENTS);

  return await getStudentFilterOptions();
}

export async function createStudentAction(
  values: z.infer<typeof CreateStudentSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.STUDENTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedFields = CreateStudentSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await createStudentService(validatedFields.data);

    return {
      success: "Student created successfully.",
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

export async function updateStudentAction(
  id: string,
  values: z.infer<typeof CreateStudentSchema>,
): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.STUDENTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedFields = CreateStudentSchema.safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields.",
    };
  }

  try {
    await updateStudentService(id, validatedFields.data);

    return {
      success: "Student updated successfully.",
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

export async function deleteStudentAction(id: string): Promise<ActionResponse> {
  try {
    await requirePermission(Permissions.STUDENTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  try {
    await deleteStudentService(id);

    return {
      success: "Student deleted successfully.",
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
