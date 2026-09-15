import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { navigation } from "../../components/layout/navigation";
import { StudentIdSchema } from "../../schemas/student.schema";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("sidebar contains no known nonexistent operational routes", () => {
  const routes = Object.values(navigation).flatMap((groups) =>
    groups.flatMap(({ items }) => items.map(({ href }) => href)),
  );

  for (const route of ["/dashboard/registration", "/dashboard/reports", "/dashboard/system", "/dashboard/settings"]) {
    assert.equal(routes.includes(route), false);
  }
  assert.equal(routes.includes("/dashboard/enrollment"), true);
});

test("Student mutation actions validate CUID identifiers", () => {
  const action = source("actions/student.action.ts");

  assert.equal(StudentIdSchema.safeParse("not-a-cuid").success, false);
  assert.match(action, /StudentIdSchema\.safeParse\(id\)/);
  assert.match(action, /updateStudentService\(validatedId\.data, validatedFields\.data\)/);
  assert.match(action, /deleteStudentService\(validatedId\.data\)/);
});

test("Student create, update, and archive commit their authoritative audits atomically", () => {
  const service = source("services/student.service.ts");

  for (const [operation, audit] of [
    ["createStudentService", 'action: "CREATE"'],
    ["updateStudentService", 'action: "UPDATE"'],
    ["deleteStudentService", 'action: "DELETE"'],
  ]) {
    const start = service.indexOf(`export async function ${operation}`);
    const end = service.indexOf("\nexport async function ", start + 1);
    const body = service.slice(start, end === -1 ? undefined : end);

    assert.match(body, /prisma\.\$transaction\(async \(transaction\)/);
    assert.match(body, new RegExp(`${audit}[\\s\\S]*createAuditLogs|createAuditLogs[\\s\\S]*${audit}`));
    assert.match(body, /createAuditLogs\([\s\S]*transaction\)/);
  }

  assert.doesNotMatch(service, /createAuditLog\(/);
});
