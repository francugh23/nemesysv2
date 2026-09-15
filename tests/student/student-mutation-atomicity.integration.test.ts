import assert from "node:assert/strict";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";
import { createAuditLogs } from "../../repositories/audit.repository";
import { createStudent, softDeleteStudent, updateStudent } from "../../repositories/student.repository";

let lrnSequence = 0;

function testLrn() {
  lrnSequence += 1;
  return `${Date.now()}${lrnSequence}`.slice(-12).padStart(12, "0");
}

test("Student create, update, and archive each persist an audit in their transaction", async () => {
  const actor = await prisma.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
  const lrn = testLrn();

  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const student = await createStudent({
        lrn,
        firstName: "Atomic",
        lastName: "Student",
        gender: "FEMALE",
        barangay: "Barangay",
        municipality: "Municipality",
        province: "Province",
        status: "UNENROLLED",
        createdBy: { connect: { id: actor.id } },
      }, transaction);
      await createAuditLogs([{ userId: actor.id, action: "CREATE", module: "Student", recordId: student.id, description: "Created student profile" }], transaction);

      await updateStudent(student.id, { firstName: "Updated" }, transaction);
      await createAuditLogs([{ userId: actor.id, action: "UPDATE", module: "Student", recordId: student.id, description: "Updated student profile" }], transaction);

      await softDeleteStudent(student.id, transaction);
      await createAuditLogs([{ userId: actor.id, action: "DELETE", module: "Student", recordId: student.id, description: "Soft deleted student profile" }], transaction);

      assert.equal(await transaction.auditLog.count({ where: { recordId: student.id, module: "Student" } }), 3);
      throw new Error("ROLLBACK_TEST");
    }),
    /ROLLBACK_TEST/,
  );

  assert.equal(await prisma.student.count({ where: { lrn } }), 0);
});

test("Student mutation rolls back when its audit write fails", async () => {
  const actor = await prisma.user.findFirstOrThrow({ where: { deletedAt: null }, select: { id: true } });
  const lrn = testLrn();

  await assert.rejects(
    prisma.$transaction(async (transaction) => {
      const student = await createStudent({
        lrn,
        firstName: "Atomic",
        lastName: "AuditFailure",
        gender: "MALE",
        barangay: "Barangay",
        municipality: "Municipality",
        province: "Province",
        status: "UNENROLLED",
        createdBy: { connect: { id: actor.id } },
      }, transaction);
      await createAuditLogs([{ userId: "missing-audit-actor", action: "CREATE", module: "Student", recordId: student.id, description: "Forced audit failure" }], transaction);
    }),
  );

  assert.equal(await prisma.student.count({ where: { lrn } }), 0);
});
