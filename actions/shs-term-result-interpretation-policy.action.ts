"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  PublishShsTermResultInterpretationPolicySchema,
  SaveShsTermResultInterpretationPolicyDraftSchema,
  ShsTermResultInterpretationPolicyReadSchema,
} from "@/schemas";
import {
  getShsTermResultInterpretationPolicyService,
  publishShsTermResultInterpretationPolicyService,
  saveShsTermResultInterpretationPolicyDraftService,
} from "@/services/shs-term-result-interpretation-policy.service";

export async function getShsTermResultInterpretationPolicyAction(values: unknown) {
  await requirePermission(Permissions.GRADES);
  return getShsTermResultInterpretationPolicyService(
    ShsTermResultInterpretationPolicyReadSchema.parse(values),
  );
}

export async function saveShsTermResultInterpretationPolicyDraftAction(values: unknown) {
  try {
    await requirePermission(Permissions.GRADES);
    const parsed = SaveShsTermResultInterpretationPolicyDraftSchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid fields." };
    return {
      success: "SHS result interpretation policy draft saved.",
      data: await saveShsTermResultInterpretationPolicyDraftService(parsed.data),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function publishShsTermResultInterpretationPolicyAction(values: unknown) {
  try {
    await requirePermission(Permissions.GRADES);
    const parsed = PublishShsTermResultInterpretationPolicySchema.safeParse(values);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid fields." };
    return {
      success: "SHS result interpretation policy published.",
      data: await publishShsTermResultInterpretationPolicyService(parsed.data),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
