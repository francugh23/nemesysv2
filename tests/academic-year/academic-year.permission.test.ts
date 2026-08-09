import assert from "node:assert/strict";
import test from "node:test";

import { hasPermission, Permissions } from "../../lib/permissions";

test("Academic Year management is limited to Super Admin and Registrar", () => {
  assert.equal(
    hasPermission("SUPER_ADMIN", Permissions.ACADEMIC_YEARS),
    true,
  );
  assert.equal(hasPermission("REGISTRAR", Permissions.ACADEMIC_YEARS), true);
  assert.equal(hasPermission("PRINCIPAL", Permissions.ACADEMIC_YEARS), false);
  assert.equal(hasPermission("TEACHER", Permissions.ACADEMIC_YEARS), false);
});

test("Registrar Academic Year access does not grant general Dashboard access", () => {
  assert.equal(hasPermission("REGISTRAR", Permissions.DASHBOARD), false);
});
