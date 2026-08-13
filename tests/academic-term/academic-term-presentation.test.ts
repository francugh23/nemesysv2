import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("Academic Term badge standardizes Term 1 through 3 and fallback styling", () => {
  const badge = readFileSync(
    path.join(root, "components/common/badges/academic-term-badge.tsx"),
    "utf8",
  );

  assert.match(badge, /const label = `Term \$\{position\}`/);
  assert.match(badge, /1: "border-blue-200/);
  assert.match(badge, /2: "border-amber-200/);
  assert.match(badge, /3: "border-emerald-200/);
  assert.match(badge, /variant=\{className \? undefined : "outline"\}/);
});

test("Academic Term read surfaces use the shared badge", () => {
  for (const file of [
    "app/(protected)/dashboard/academic-years/components/academic-term-manager.tsx",
    "app/(protected)/dashboard/academic-years/components/curriculum-adoption-dialog.tsx",
    "app/(protected)/dashboard/enrollment/components/enrollment-view-dialog.tsx",
    "app/(protected)/dashboard/enrollment/components/student-subject-enrollment-list.tsx",
    "app/(protected)/dashboard/subject-offerings/components/subject-offering-columns.tsx",
  ]) {
    const source = readFileSync(path.join(root, file), "utf8");
    assert.match(source, /AcademicTermBadge/);
    assert.doesNotMatch(source, /\.position\}\.\s*\{[^}]+\.name\}/);
  }
});

test("Academic Term selectors remain textual, ordered, and searchable", () => {
  const enrollmentForm = readFileSync(
    path.join(
      root,
      "app/(protected)/dashboard/enrollment/components/enrollment-form.tsx",
    ),
    "utf8",
  );
  const offeringForm = readFileSync(
    path.join(
      root,
      "app/(protected)/dashboard/subject-offerings/components/subject-offering-form.tsx",
    ),
    "utf8",
  );
  const shsSelection = readFileSync(
    path.join(
      root,
      "app/(protected)/dashboard/enrollment/components/shs-curriculum-selection.tsx",
    ),
    "utf8",
  );

  assert.match(enrollmentForm, /label: `Term \$\{term\.position\}`/);
  assert.match(enrollmentForm, /searchValue: `\$\{term\.position\} \$\{term\.name\}`/);
  assert.match(offeringForm, /Term \{term\.position\}/);
  assert.match(shsSelection, /Term \{term\.academicTerm\.position\}/);
});
