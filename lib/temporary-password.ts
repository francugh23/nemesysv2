import { randomInt } from "node:crypto";

const TEMPORARY_PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TEMPORARY_PASSWORD_LENGTH = 8;

export function generateTemporaryPassword() {
  return Array.from(
    { length: TEMPORARY_PASSWORD_LENGTH },
    () =>
      TEMPORARY_PASSWORD_ALPHABET[
        randomInt(TEMPORARY_PASSWORD_ALPHABET.length)
      ],
  ).join("");
}
