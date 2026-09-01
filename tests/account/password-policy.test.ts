import assert from "node:assert/strict";
import test from "node:test";

import {
  BcryptPasswordInputSchema,
  createPermanentPasswordSchema,
  DEFAULT_PASSWORD_POLICY,
  getPasswordByteLength,
  getPasswordCharacterLength,
} from "../../lib/password-policy";
import { ChangeOwnPasswordSchema } from "../../schemas/account.schema";
import { CreateTeacherSchema } from "../../schemas/teacher.schema";

test("default permanent password policy enforces approved length limits", () => {
  const schema = createPermanentPasswordSchema();

  assert.equal(schema.safeParse("a".repeat(5)).success, false);
  assert.equal(schema.safeParse("a".repeat(6)).success, true);
  assert.equal(schema.safeParse("a".repeat(64)).success, true);
  assert.equal(schema.safeParse("a".repeat(65)).success, false);
});

test("password policy permits whitespace and Unicode within bcrypt limits", () => {
  const password = `secure phrase ${String.fromCodePoint(0x1f642)}`;

  assert.ok(password.length >= DEFAULT_PASSWORD_POLICY.minLength);
  assert.ok(getPasswordByteLength(password) <= DEFAULT_PASSWORD_POLICY.maxBytes);
  assert.equal(createPermanentPasswordSchema().safeParse(password).success, true);
});

test("password policy preserves leading and trailing whitespace", () => {
  const password = "  ab  ";
  const result = createPermanentPasswordSchema().safeParse(password);

  assert.equal(result.success, true);
  assert.equal(result.success ? result.data : null, password);
});

test("password policy rejects values exceeding bcrypt's UTF-8 byte limit", () => {
  const password = String.fromCodePoint(0x1f642).repeat(24) + "a".repeat(16);

  assert.ok(password.length <= DEFAULT_PASSWORD_POLICY.maxLength);
  assert.ok(getPasswordByteLength(password) > DEFAULT_PASSWORD_POLICY.maxBytes);
  assert.equal(createPermanentPasswordSchema().safeParse(password).success, false);
  assert.equal(BcryptPasswordInputSchema.safeParse(password).success, false);
});

test("password length counts Unicode code points rather than UTF-16 units", () => {
  const password = String.fromCodePoint(0x1f642).repeat(5);

  assert.equal(getPasswordCharacterLength(password), 5);
  assert.equal(password.length, 10);
  assert.equal(createPermanentPasswordSchema().safeParse(password).success, false);
});

test("change-password schema requires matching replacement values", () => {
  const result = ChangeOwnPasswordSchema.safeParse({
    currentPassword: "temporary-password",
    newPassword: "a sufficiently long password",
    confirmPassword: "a different long password",
  });

  assert.equal(result.success, false);
  assert.ok(
    !result.success &&
      result.error.issues.some(
        (issue) => issue.path[0] === "confirmPassword",
      ),
  );
});

test("change-password schema rejects exact current-password reuse", () => {
  const password = "a sufficiently long password";
  const result = ChangeOwnPasswordSchema.safeParse({
    currentPassword: password,
    newPassword: password,
    confirmPassword: password,
  });

  assert.equal(result.success, false);
  assert.ok(
    !result.success &&
      result.error.issues.some((issue) => issue.path[0] === "newPassword"),
  );
});

test("Teacher personnel creation does not accept credential requirements", () => {
  const teacher = {
    employeeNumber: "T-001",
    email: "teacher@example.com",
    firstName: "Test",
    middleName: "",
    lastName: "Teacher",
    gender: "MALE" as const,
    degree: "",
    major: "",
  };

  assert.equal(CreateTeacherSchema.safeParse(teacher).success, true);
});
