"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import { CreateStudentSchema } from "@/schemas";
import { importStudentsService } from "@/services/student.service";
import type { ActionResponse } from "@/types/action-response";

type StudentImportActionResponse = ActionResponse & {
  importedCount?: number;
  skippedCount?: number;
};

export async function importStudentsAction(
  values: unknown,
): Promise<StudentImportActionResponse> {
  try {
    await requirePermission(Permissions.STUDENTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  const validatedFields = CreateStudentSchema.array().safeParse(values);

  if (!validatedFields.success) {
    return {
      error: "Invalid import data.",
    };
  }

  const lrns = new Set<string>();

  for (const student of validatedFields.data) {
    if (lrns.has(student.lrn)) {
      return {
        error: `Duplicate LRN in import: ${student.lrn}`,
      };
    }

    lrns.add(student.lrn);
  }

  try {
    const result = await importStudentsService(validatedFields.data);

    return {
      success: `${result.importedCount} student${result.importedCount === 1 ? "" : "s"} imported successfully.`,
      importedCount: result.importedCount,
      skippedCount: result.skippedCount,
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
