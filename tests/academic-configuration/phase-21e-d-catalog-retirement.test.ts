import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { navigation } from "../../components/layout/navigation";
import { hasPermission, Permissions } from "../../lib/permissions";
import type { CurriculumAdoptionOffering } from "../../repositories/curriculum-adoption.repository";
import { getCurriculumAdoptionInvalidReasons } from "../../services/curriculum-adoption-eligibility.service";

const readSource = (relativePath: string) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");

test("Curriculum and Subjects retire the DepEd catalog from routine workflow", async () => {
  const [page, subjectColumns, subjectView, form] = await Promise.all([
    readSource("app/(protected)/dashboard/subject-offerings/page.tsx"),
    readSource("app/(protected)/dashboard/subjects/components/subject-columns.tsx"),
    readSource("app/(protected)/dashboard/subjects/components/subject-view-dialog.tsx"),
    readSource("app/(protected)/dashboard/subject-offerings/components/subject-offering-form.tsx"),
  ]);

  assert.doesNotMatch(page, /DepEd Reference Catalog|ShsCurriculumReferenceTable/);
  assert.doesNotMatch(subjectColumns, /DepEd reference available|hasDepEdReference/);
  assert.doesNotMatch(subjectView, /DepEd reference available|hasDepEdReference/);
  assert.doesNotMatch(form, /DepEd Source Reference/);
  assert.match(form, /Source \/ Provenance Reference/);
  assert.match(form, /separate school-approval action before student use/);
});

test("runtime catalog pagination and read APIs are removed while persistence remains", async () => {
  const [schema, action, service, repository, hook, catalogService] =
    await Promise.all([
      readSource("prisma/schema.prisma"),
      readSource("actions/subject-offering.action.ts"),
      readSource("services/subject-offering.service.ts"),
      readSource("repositories/subject-offering.repository.ts"),
      readSource("hooks/subject-offering.hook.ts"),
      readSource("services/deped-reference-catalog.service.ts"),
    ]);

  for (const source of [action, service, repository, hook]) {
    assert.doesNotMatch(
      source,
      /getShsCurriculumReferences|countShsCurriculumReferences|ShsCurriculumReferenceTableQuery|shs-curriculum-references/,
    );
  }
  assert.match(schema, /model ShsCurriculumReference \{/);
  assert.match(schema, /sourceReference\s+String/);
  assert.match(catalogService, /createCatalogReference|updateCatalogReference/);
});

test("canonical configuration routes remain unchanged with no reference route", () => {
  const items = Object.values(navigation).flatMap((groups) =>
    groups.flatMap(({ items: groupItems }) => groupItems),
  );

  assert.ok(items.some(({ href }) => href === "/dashboard/academic-years"));
  assert.ok(items.some(({ href }) => href === "/dashboard/subjects"));
  assert.ok(items.some(({ href }) => href === "/dashboard/subject-offerings"));
  assert.ok(!items.some(({ href }) => /reference|catalog/.test(href)));
});

test("school-controlled Curriculum keeps explicit SHS, Term, cluster, provenance, and approval controls", async () => {
  const [form, columns, dialogs] = await Promise.all([
    readSource("app/(protected)/dashboard/subject-offerings/components/subject-offering-form.tsx"),
    readSource("app/(protected)/dashboard/subject-offerings/components/subject-offering-columns.tsx"),
    readSource("app/(protected)/dashboard/subject-offerings/components/subject-offering-dialogs.tsx"),
  ]);

  for (const label of [
    "Academic Year",
    "Grade Level",
    "Subject",
    "Core Subject",
    "Academic Elective",
    "TechPro Elective",
    "School-Facing Cluster",
    "Academic Terms",
    "Source / Provenance Reference",
  ]) {
    assert.match(form, new RegExp(label.replace("/", "\\/")));
  }
  assert.match(form, /Full Academic Year/);
  assert.match(form, /No all-Term or Grade 12 TechPro placement is inferred/);
  assert.match(columns, /Pending School Approval/);
  assert.match(dialogs, /School approval reference/);
});

test("Academic and TechPro school-facing clusters are operationally manageable", async () => {
  const [clusterDialog, service, repository] = await Promise.all([
    readSource("app/(protected)/dashboard/subject-offerings/components/shs-curriculum-cluster-dialog.tsx"),
    readSource("services/subject-offering.service.ts"),
    readSource("repositories/subject-offering.repository.ts"),
  ]);

  assert.match(clusterDialog, /value="ACADEMIC">Academic/);
  assert.match(clusterDialog, /value="TECHPRO">TechPro/);
  assert.match(clusterDialog, /school-managed Academic or TechPro categories/);
  assert.match(clusterDialog, /Preserved historical category/);
  assert.match(clusterDialog, /Track is fixed after creation/);
  assert.doesNotMatch(service, /Academic school-facing categories are fixed/);
  assert.match(service, /Source-backed historical SHS curriculum clusters cannot be changed/);
  assert.match(service, /cluster track cannot be changed after creation/);
  assert.match(repository, /deletedAt: null, isSchoolFacing: true/);
});

test("source-only elective clusters are rejected before adoption commit", async () => {
  const source = {
    id: "offering",
    subjectId: "subject",
    academicYearId: "source-year",
    gradeLevel: "11",
    subjectCode: "TEST",
    subjectDescription: "Test Subject",
    deletedAt: null,
    subject: { gradeLevel: "11", deletedAt: null },
    terms: [{ academicTermId: "term-1" }],
    shsContext: {
      classification: "ACADEMIC_ELECTIVE",
      curriculumStatus: "PROVISIONAL_DEPED",
      sourceReference: "Historical source",
      clusterId: "source-cluster",
      cluster: {
        id: "source-cluster",
        code: "SOURCE",
        name: "Source-only category",
        track: "ACADEMIC",
        isSchoolFacing: false,
        deletedAt: null,
      },
    },
  } as CurriculumAdoptionOffering;
  const reasons = getCurriculumAdoptionInvalidReasons(source);
  const [service, repository] = await Promise.all([
    readSource("services/curriculum-adoption.service.ts"),
    readSource("repositories/curriculum-adoption.repository.ts"),
  ]);

  assert.ok(
    reasons.some(({ code }) => code === "SHS_CLUSTER_NOT_SCHOOL_FACING"),
  );
  assert.match(service, /getCurriculumAdoptionInvalidReasons\(offering\)/);
  assert.match(service, /eligibleById/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(repository, /isSchoolFacing: true/);
  assert.match(repository, /curriculumStatus: "PROVISIONAL_DEPED"/);
  assert.match(repository, /approvalReference: null/);
  assert.match(repository, /approvedById: null/);
  assert.match(repository, /approvedAt: null/);
});

test("Phase 21E-D preserves permissions and student-history boundaries", async () => {
  const [schema, selectionService] = await Promise.all([
    readSource("prisma/schema.prisma"),
    readSource("services/student-subject-enrollment-selection.service.ts"),
  ]);

  assert.equal(hasPermission("SUPER_ADMIN", Permissions.SUBJECTS), true);
  assert.equal(hasPermission("REGISTRAR", Permissions.SUBJECTS), false);
  assert.equal(
    hasPermission("REGISTRAR", Permissions.SHS_CURRICULUM_APPROVAL),
    true,
  );
  assert.match(schema, /shsSourceReference\s+String\?/);
  assert.match(schema, /shsApprovalReference\s+String\?/);
  assert.match(selectionService, /SCHOOL_APPROVED/);
  assert.doesNotMatch(selectionService, /ShsCurriculumReference/);
});

test("Offering and cluster mutations refresh adoption eligibility", async () => {
  const hook = await readSource("hooks/subject-offering.hook.ts");

  assert.match(hook, /queryKey: \["curriculum-adoption-preview"\]/);
});
