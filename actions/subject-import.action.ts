"use server";

import { getSubjectIdentityKey, normalizeSubjectIdentity } from "@/lib/subject-identity";
import { Permissions, requirePermission } from "@/lib/authorization";
import { CreateSubjectSchema } from "@/schemas";
import { importSubjectsService } from "@/services/subject.service";
import type { ActionResponse } from "@/types/action-response";
import { normalizeSubjectImportRow } from "@/app/(protected)/dashboard/subjects/lib/subject-import-normalizer";

type SubjectImportActionResponse = ActionResponse & {
  importedCount?: number;
  skippedCount?: number;
};

export async function importSubjectsAction(
  values: unknown,
): Promise<SubjectImportActionResponse> {
  try {
    await requirePermission(Permissions.SUBJECTS);
  } catch {
    return {
      error: "Unauthorized.",
    };
  }

  if (!Array.isArray(values)) {
    return {
      error: "Invalid import data.",
    };
  }

  const normalizedRows = values.map((value) =>
    normalizeSubjectImportRow(
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {},
    ),
  );
  const validatedFields = CreateSubjectSchema.array().safeParse(normalizedRows);

  if (!validatedFields.success) {
    return {
      error: "Invalid import data.",
    };
  }

  const identities = new Set<string>();

  for (const subject of validatedFields.data) {
    const identityKey = getSubjectIdentityKey(
      normalizeSubjectIdentity(subject),
    );

    if (identities.has(identityKey)) {
      return {
        error: "Duplicate Subject identity in import data.",
      };
    }

    identities.add(identityKey);
  }

  try {
    const result = await importSubjectsService(validatedFields.data);

    return {
      success: `${result.importedCount} subject${result.importedCount === 1 ? "" : "s"} imported successfully.`,
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
