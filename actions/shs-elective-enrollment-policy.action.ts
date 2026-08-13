"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  CreateShsElectiveEnrollmentPolicySchema,
  ShsElectiveEnrollmentPolicyListSchema,
  UpdateShsElectiveEnrollmentPolicySchema,
} from "@/schemas";
import {
  createShsElectiveEnrollmentPolicyService,
  getShsElectiveEnrollmentPolicies,
  updateShsElectiveEnrollmentPolicyService,
} from "@/services/shs-elective-enrollment-policy.service";

export async function getShsElectiveEnrollmentPoliciesAction(query: unknown) {
  await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);
  return getShsElectiveEnrollmentPolicies(
    ShsElectiveEnrollmentPolicyListSchema.parse(query),
  );
}

export async function createShsElectiveEnrollmentPolicyAction(values: unknown) {
  try {
    await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);
    const parsed = CreateShsElectiveEnrollmentPolicySchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid fields." };
    }
    return {
      success: "SHS elective policy created.",
      data: await createShsElectiveEnrollmentPolicyService(parsed.data),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export async function updateShsElectiveEnrollmentPolicyAction(
  id: string,
  values: unknown,
) {
  try {
    await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);
    const parsed = UpdateShsElectiveEnrollmentPolicySchema.safeParse(values);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid fields." };
    }
    return {
      success: "SHS elective policy updated.",
      data: await updateShsElectiveEnrollmentPolicyService(id, parsed.data),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
