"use server";

import { requireAuthenticatedUser } from "@/lib/authorization";
import {
  ChangeOwnPasswordSchema,
  type ChangeOwnPasswordInput,
} from "@/schemas";
import {
  AccountPasswordError,
  changeOwnPasswordService,
} from "@/services/account.service";
import type { ActionResponse } from "@/types/action-response";

type ChangePasswordActionResponse = ActionResponse & {
  sessionInvalid?: boolean;
};

export async function changeOwnPasswordAction(
  values: ChangeOwnPasswordInput,
): Promise<ChangePasswordActionResponse> {
  try {
    await requireAuthenticatedUser();
  } catch {
    return { error: "Unauthorized.", sessionInvalid: true };
  }

  const validatedFields = ChangeOwnPasswordSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: "Invalid password fields." };
  }

  try {
    await changeOwnPasswordService(validatedFields.data);

    return {
      success: "Password changed. Sign in with your new password.",
    };
  } catch (error) {
    if (error instanceof AccountPasswordError) {
      return { error: error.message };
    }

    return { error: "Something went wrong." };
  }
}
