"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  FinalizeShsTermResultSchema,
  SaveShsTermResultDraftSchema,
} from "@/schemas";
import {
  finalizeShsTermResultService,
  saveShsTermResultDraftService,
} from "@/services/shs-term-result.service";

export async function saveShsTermResultDraftAction(values: unknown) {
  try {
    await requirePermission(Permissions.GRADES);
    const parsed = SaveShsTermResultDraftSchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid fields." };
    return {
      success: "SHS Term Result draft saved.",
      data: await saveShsTermResultDraftService(parsed.data),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function finalizeShsTermResultAction(values: unknown) {
  try {
    await requirePermission(Permissions.GRADES);
    const parsed = FinalizeShsTermResultSchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid fields." };
    return {
      success: "SHS Term Result finalized.",
      data: await finalizeShsTermResultService(parsed.data),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
