import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { CreateTeacherSchema } from "../../schemas/teacher.schema";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

test("Phase 23-B1 Teacher owns personnel identity while User linking stays optional", async () => {
  const [schema, migration] = await Promise.all([
    read("prisma/schema.prisma"),
    read("prisma/migrations/20260901090000_phase23b1_independent_teacher_personnel/migration.sql"),
  ]);
  const teacher = schema.match(/model Teacher \{[\s\S]*?\n\}/)?.[0];
  assert.ok(teacher);
  assert.match(teacher, /employeeNumber String @unique/);
  assert.match(teacher, /firstName\s+String[\s\S]*lastName\s+String[\s\S]*gender\s+Gender/);
  assert.match(teacher, /email\s+String\?/);
  assert.match(teacher, /userId String\? @unique/);
  assert.match(teacher, /status\s+TeacherStatus @default\(ACTIVE\)/);
  assert.doesNotMatch(teacher, /isAdviser/);
  assert.match(migration, /upper\(btrim\("user"\."employeeNumber"\)\)/);
  assert.match(migration, /ALTER COLUMN "userId" DROP NOT NULL/);
  assert.match(migration, /canonical employee number collision/);
});

test("Phase 23-B1 personnel input requires no credentials and validates optional email", () => {
  const base = { employeeNumber: " t-001 ", firstName: "Test", middleName: "", lastName: "Teacher", gender: "MALE" as const, degree: "", major: "" };
  assert.equal(CreateTeacherSchema.safeParse(base).success, true);
  assert.equal(CreateTeacherSchema.safeParse({ ...base, email: "invalid" }).success, false);
  assert.equal(CreateTeacherSchema.safeParse({ ...base, username: "not-required", temporaryPassword: "not-required" }).success, true);
});

test("Phase 23-B1 lifecycle guards preserve assignment and adviser ownership", async () => {
  const [service, identity, repository, assignmentService] = await Promise.all([
    read("services/teacher.service.ts"),
    read("lib/teacher-identity.ts"),
    read("repositories/teacher.repository.ts"),
    read("services/subject-assignment.service.ts"),
  ]);
  assert.match(identity, /canonicalEmployeeNumber\(value: string\)[\s\S]*toUpperCase/);
  assert.match(identity, /value\?\.trim\(\)\.toLowerCase\(\)/);
  assert.match(service, /hasActiveTeacherDependencies/);
  assert.match(service, /active Subject Assignments/);
  assert.match(service, /adviser of an active Section/);
  assert.match(repository, /status: "ACTIVE"/);
  assert.match(repository, /subjectAssignments: \{ where: \{ deletedAt: null \} \}/);
  assert.match(repository, /advisedSections: \{ where: \{ deletedAt: null \} \}/);
  assert.match(assignmentService, /Teacher not found or inactive/);
});
