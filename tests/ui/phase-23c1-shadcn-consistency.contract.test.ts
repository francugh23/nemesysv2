import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const read = (file: string) => readFile(path.join(process.cwd(), file), "utf8");

test("Teaching Assignment navigation reuses the Academic Configuration segmented pattern", async () => {
  const [navigation, academicNavigation, assignments] = await Promise.all([
    read("components/common/segmented-navigation.tsx"),
    read("components/common/academic-configuration-nav.tsx"),
    read("app/(protected)/dashboard/assignments/page.tsx"),
  ]);
  assert.match(navigation, /flex w-fit flex-wrap gap-1 rounded-lg border bg-muted\/30 p-1/);
  assert.match(academicNavigation, /<SegmentedNavigation ariaLabel="Related academic configuration">/);
  assert.match(assignments, /<SegmentedNavigation ariaLabel="Teaching assignment view">/);
  assert.match(assignments, /variant: view === "matrix" \? "secondary" : "ghost"/);
  assert.match(assignments, /aria-pressed/);
});

test("Teaching Assignment grade selection uses existing shadcn Select primitives", async () => {
  const assignments = await read("app/(protected)/dashboard/assignments/page.tsx");
  assert.match(assignments, /Select, SelectContent, SelectItem, SelectTrigger, SelectValue/);
  assert.match(assignments, /<Select value=\{gradeLevel\}/);
  assert.match(assignments, /<SelectTrigger aria-label="Grade">/);
  assert.doesNotMatch(assignments, /<select/);
});
