import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "dotenv/config";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AcademicTermBadge } from "../../components/common/badges";
import { navigation } from "../../components/layout/navigation";
import {
  ACADEMIC_CONFIGURATION_HIERARCHY,
  ACADEMIC_CONFIGURATION_LINKS,
  CURRICULUM_DESCRIPTION,
  CURRICULUM_ROUTE,
  SUBJECTS_DESCRIPTION,
} from "../../lib/academic-configuration";
import { findNonArchivedSubjects } from "../../repositories/subject.repository";
import { SubjectTableQuerySchema } from "../../schemas/subject.schema";

const readSource = (relativePath: string) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("Academic Configuration navigation preserves canonical routes and order", () => {
  assert.deepEqual(ACADEMIC_CONFIGURATION_HIERARCHY, [
    "Academic Years",
    "Subjects",
    "Curriculum",
  ]);
  assert.deepEqual(ACADEMIC_CONFIGURATION_LINKS, [
    { title: "Academic Years", href: "/dashboard/academic-years" },
    { title: "Subjects", href: "/dashboard/subjects" },
    { title: "Curriculum", href: "/dashboard/subject-offerings" },
  ]);

  const superAdminGroup = navigation.SUPER_ADMIN.find(
    (group) => group.title === "Academic Configuration",
  );
  assert.deepEqual(
    superAdminGroup?.items.map(({ title, href }) => ({ title, href })),
    ACADEMIC_CONFIGURATION_LINKS,
  );
  assert.ok(
    !superAdminGroup?.items.some(({ title }) =>
      ["Sections", "Assignments"].includes(title),
    ),
  );
  assert.ok(
    !navigation.SUPER_ADMIN.flatMap(({ items }) => items).some(
      ({ href }) => href === "/dashboard/curriculum",
    ),
  );
  assert.equal(CURRICULUM_ROUTE, "/dashboard/subject-offerings");
});

test("Subjects explain reusable definitions and distinguish JHS from SHS", async () => {
  const [page, columns, repository] = await Promise.all([
    readSource("app/(protected)/dashboard/subjects/page.tsx"),
    readSource("app/(protected)/dashboard/subjects/components/subject-columns.tsx"),
    readSource("repositories/subject.repository.ts"),
  ]);

  assert.match(SUBJECTS_DESCRIPTION, /reusable academic definition/i);
  assert.match(SUBJECTS_DESCRIPTION, /does not add it to an Academic Year/i);
  assert.match(SUBJECTS_DESCRIPTION, /make it part of Curriculum/i);
  assert.match(SUBJECTS_DESCRIPTION, /enroll students/i);
  assert.match(page, /JHS and SHS|Reusable definition/);
  assert.doesNotMatch(columns, /DepEd reference available/);
  assert.match(columns, /No active Curriculum/);
  assert.doesNotMatch(repository, /shsCurriculumReferences: true/);
  assert.match(repository, /offerings: \{ where: \{ deletedAt: null \} \}/);
  assert.doesNotMatch(columns, /CORE|ACADEMIC_ELECTIVE|TECHPRO_ELECTIVE/);
});

test("Subject level filtering and usage indicators use existing read-only relations", async () => {
  const [jhs, shs] = await Promise.all([
    findNonArchivedSubjects(
      { schoolLevel: "JHS" },
      { skip: 0, take: 50 },
      [{ id: "asc" }],
    ),
    findNonArchivedSubjects(
      { schoolLevel: "SHS" },
      { skip: 0, take: 250 },
      [{ id: "asc" }],
    ),
  ]);

  assert.ok(jhs.length > 0);
  assert.ok(shs.length > 0);
  assert.ok(jhs.every(({ gradeLevel }) => ["7", "8", "9", "10"].includes(gradeLevel)));
  assert.ok(shs.every(({ gradeLevel }) => ["11", "12"].includes(gradeLevel)));
  assert.ok(shs.every(({ _count }) => _count.offerings >= 0));
  assert.equal(
    SubjectTableQuerySchema.safeParse({ schoolLevel: "JHS", grade: "11" }).success,
    false,
  );
  assert.equal(
    SubjectTableQuerySchema.safeParse({ schoolLevel: "SHS", grade: "10" }).success,
    false,
  );
});

test("Curriculum presents JHS full-year and explicit SHS Offering context", async () => {
  const [page, form, columns] = await Promise.all([
    readSource("app/(protected)/dashboard/subject-offerings/page.tsx"),
    readSource("app/(protected)/dashboard/subject-offerings/components/subject-offering-form.tsx"),
    readSource("app/(protected)/dashboard/subject-offerings/components/subject-offering-columns.tsx"),
  ]);

  assert.match(CURRICULUM_DESCRIPTION, /Academic-Year-specific/);
  assert.match(page, /Subject = reusable definition/);
  assert.match(form, /Full Academic Year/);
  assert.match(form, /JHS uses every configured Term/);
  assert.match(form, /exact Terms for this SHS Offering/);
  assert.match(form, /No all-Term or Grade 12 TechPro placement is inferred/);
  assert.match(form, /Core Subject/);
  assert.match(form, /Academic Elective/);
  assert.match(form, /TechPro Elective/);
  assert.match(form, /School-Facing Cluster/);
  assert.match(columns, /SHS Context \/ Approval/);
});

test("Academic Term badges keep canonical labels without redundant configured names", () => {
  const canonical = renderToStaticMarkup(
    createElement(AcademicTermBadge, { position: 1, name: "Term 1" }),
  );
  const informative = renderToStaticMarkup(
    createElement(AcademicTermBadge, { position: 2, name: "Midyear" }),
  );

  assert.equal((canonical.match(/Term 1/g) ?? []).length, 3);
  assert.doesNotMatch(canonical, /Term 1: Term 1|1\. Term 1|Term 1 - Term 1/);
  assert.match(informative, /Term 2: Midyear/);
});

test("SHS filters and policies remain clearly scoped without catalog workflow", async () => {
  const [page, policyManager] = await Promise.all([
    readSource("app/(protected)/dashboard/subject-offerings/page.tsx"),
    readSource("app/(protected)/dashboard/academic-years/components/shs-elective-enrollment-policy-manager.tsx"),
  ]);

  assert.match(page, /isShsGrade &&/);
  assert.match(page, /SHS Approval Status/);
  assert.doesNotMatch(page, /DepEd Reference Catalog|ShsCurriculumReferenceTable/);
  assert.match(page, /Pending School Approval/);
  assert.match(policyManager, /Elective Policy controls how many/);
  assert.match(policyManager, /Curriculum separately\s+defines which subjects/);
});

test("Academic Year details links to filtered canonical Curriculum", async () => {
  const details = await readSource(
    "app/(protected)/dashboard/academic-years/components/academic-year-view-dialog.tsx",
  );

  assert.match(details, /View Curriculum for this Academic Year/);
  assert.match(details, /\?academicYearId=/);
  assert.match(details, /CURRICULUM_ROUTE/);
});

test("Phase 21E leaves legacy Subject Assignment identity unchanged", async () => {
  const schema = await readSource("prisma/schema.prisma");
  const model = schema.match(/model SubjectAssignment \{[\s\S]*?\n\}/)?.[0];
  const assignmentItem = navigation.SUPER_ADMIN.flatMap(({ items }) => items).find(
    ({ href }) => href === "/dashboard/assignments",
  );

  assert.ok(model);
  assert.match(model, /subjectId String/);
  assert.match(model, /teacherId String/);
  assert.match(model, /sectionId String/);
  assert.match(model, /academicYearId String/);
  assert.doesNotMatch(model, /subjectOfferingId|academicTermId/);
  assert.equal(assignmentItem?.title, "Assignments");
});
