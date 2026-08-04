import { z } from "zod";

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  maxBytes: number;
}

export const DEFAULT_PASSWORD_POLICY = Object.freeze({
  minLength: 6,
  maxLength: 64,
  maxBytes: 72,
}) satisfies PasswordPolicy;

export function getPasswordByteLength(password: string) {
  return new TextEncoder().encode(password).length;
}

export function getPasswordCharacterLength(password: string) {
  return Array.from(password).length;
}

export function createPermanentPasswordSchema(
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
) {
  return z
    .string()
    .refine(
      (password) => getPasswordCharacterLength(password) >= policy.minLength,
      {
        message: `Password must be at least ${policy.minLength} characters.`,
      },
    )
    .refine(
      (password) => getPasswordCharacterLength(password) <= policy.maxLength,
      {
        message: `Password must be at most ${policy.maxLength} characters.`,
      },
    )
    .refine((password) => getPasswordByteLength(password) <= policy.maxBytes, {
      message: `Password must be at most ${policy.maxBytes} UTF-8 bytes.`,
    });
}

export const BcryptPasswordInputSchema = z
  .string()
  .min(1, "Password is required.")
  .refine(
    (password) =>
      getPasswordByteLength(password) <= DEFAULT_PASSWORD_POLICY.maxBytes,
    {
      message: `Password must be at most ${DEFAULT_PASSWORD_POLICY.maxBytes} UTF-8 bytes.`,
    },
  );

export const PermanentPasswordSchema = createPermanentPasswordSchema();
