import assert from "node:assert/strict";
import test from "node:test";

import { navigation } from "../../components/layout/navigation";
import { formatPageTitle } from "../../components/layout/page-title";
import {
  ACADEMIC_CONFIGURATION_HIERARCHY,
  CURRICULUM_ROUTE,
  CURRICULUM_TITLE,
} from "../../lib/academic-configuration";
import { hasPermission, Permissions } from "../../lib/permissions";

test("Phase 21A presents the approved academic configuration hierarchy", () => {
  assert.deepEqual(ACADEMIC_CONFIGURATION_HIERARCHY, [
    "Academic Years",
    "Academic Terms",
    "Subjects",
    "Curriculum",
    "Enrollment",
  ]);
});

test("Curriculum terminology retains the canonical Subject Offering route", () => {
  for (const role of ["SUPER_ADMIN", "REGISTRAR"] as const) {
    const curriculumItem = navigation[role]
      .flatMap(({ items }) => items)
      .find(({ title }) => title === CURRICULUM_TITLE);

    assert.equal(curriculumItem?.href, CURRICULUM_ROUTE);
    assert.ok(
      !navigation[role]
        .flatMap(({ items }) => items)
        .some(({ href }) => href === "/dashboard/curriculum"),
    );
  }
});

test("Curriculum breadcrumb uses UI terminology without changing generic titles", () => {
  assert.equal(formatPageTitle(CURRICULUM_ROUTE), CURRICULUM_TITLE);
  assert.equal(formatPageTitle("/dashboard/academic-years"), "Academic Years");
  assert.equal(formatPageTitle("/dashboard/subjects"), "Subjects");
});

test("Phase 21A preserves the existing Curriculum and Subject permission split", () => {
  assert.equal(hasPermission("SUPER_ADMIN", Permissions.SUBJECTS), true);
  assert.equal(hasPermission("REGISTRAR", Permissions.SUBJECTS), false);
  assert.equal(
    hasPermission("SUPER_ADMIN", Permissions.SHS_CURRICULUM_APPROVAL),
    true,
  );
  assert.equal(
    hasPermission("REGISTRAR", Permissions.SHS_CURRICULUM_APPROVAL),
    true,
  );
});
