import { z } from "zod";

import {
  BcryptPasswordInputSchema,
  PermanentPasswordSchema,
} from "@/lib/password-policy";

export const ChangeOwnPasswordSchema = z
  .object({
    currentPassword: BcryptPasswordInputSchema,
    newPassword: PermanentPasswordSchema,
    confirmPassword: PermanentPasswordSchema,
  })
  .superRefine((values, context) => {
    if (values.newPassword !== values.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }

    if (values.currentPassword === values.newPassword) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "New password must be different from the current password.",
      });
    }
  });

export type ChangeOwnPasswordInput = z.infer<typeof ChangeOwnPasswordSchema>;
