import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "dotenv/config";

import prisma from "../../lib/prisma";
import { hasPermission, Permissions } from "../../lib/permissions";
import {
  countOfferings,
  findAcademicYearOfferingGradeCounts,
} from "../../repositories/subject-offering.repository";
import { buildAcademicYearConfigurationSummary } from "../../services/academic-year-configuration-summary.service";

const readSource = (relativePath: string) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), "utf8");

type BuilderInput = Parameters<typeof buildAcademicYearConfigurationSummary>[0];

function term(position: number) {
  const startMonth = position * 2;
  return {
    id: `term-${position}`,
    academicYearId: "year",
    name: `Term ${position}`,
    position,
    startDate: new Date(Date.UTC(2026, startMonth, 1)),
    endDate: new Date(Date.UTC(2026, startMonth + 1, 1)),
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

function buildInput(
  overrides: Partial<BuilderInput> = {},
): BuilderInput {
  return {
    academicYear: {
      id: "year",
      label: "2026-2027",
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2027-04-30T00:00:00.000Z"),
      status: "DRAFT",
      createdAt: new Date(0),
      updatedAt: new Date(0),
      terms: [term(1), term(2), term(3)],
    },
    curriculum: {
      activeOfferingCount: 2,
      gradeCounts: [
        { gradeLevel: "7", count: 1 },
        { gradeLevel: "11", count: 1 },
      ],
      provisionalShsOfferingCount: 1,
      pendingShsOfferingCount: 1,
      schoolApprovedShsOfferingCount: 0,
      controlledCorrectionCount: 0,
    },
    electivePolicies: [],
    includeResultPolicy: false,
    ...overrides,
  } as BuilderInput;
}

test("Phase 21E-C summary read preserves layered authorization", async () => {
  const [action, service] = await Promise.all([
    readSource("actions/academic-year.action.ts"),
    readSource("services/academic-year.service.ts"),
  ]);

  assert.match(
    action,
    /getAcademicYearConfigurationSummaryAction[\s\S]*requirePermission\(Permissions\.ACADEMIC_YEARS\)/,
  );
  assert.match(
    action,
    /getAcademicYearConfigurationSummaryAction[\s\S]*requirePermission\(Permissions\.SHS_CURRICULUM_APPROVAL\)/,
  );
  assert.match(
    service,
    /getAcademicYearConfigurationSummaryService[\s\S]*requirePermission\(Permissions\.ACADEMIC_YEARS\)/,
  );
  assert.match(
    service,
    /getAcademicYearConfigurationSummaryService[\s\S]*requirePermission\(Permissions\.SHS_CURRICULUM_APPROVAL\)/,
  );
  assert.match(service, /TransactionIsolationLevel\.RepeatableRead/);
});

test("Registrar cannot receive result interpretation policy facts", () => {
  const includeResultPolicy = hasPermission("REGISTRAR", Permissions.GRADES);
  const summary = buildAcademicYearConfigurationSummary(
    buildInput({
      includeResultPolicy,
      resultPolicy: {
        status: "PUBLISHED",
        passingThreshold: 75,
        sourceReference: "Restricted policy reference",
      } as unknown as BuilderInput["resultPolicy"],
    }),
  );

  assert.equal(includeResultPolicy, false);
  assert.equal("resultInterpretationPolicy" in summary, false);
  assert.ok(summary.notices.every(({ code }) => code !== "RESULT_POLICY_STATUS"));
});

test("Curriculum aggregates exclude archived Offerings and represent active grades", async () => {
  const academicYearId = "academic-year-2026-2027";
  const [allCount, activeCount, gradeCounts, provisionalCount, approvedCount] =
    await Promise.all([
      prisma.subjectOffering.count({ where: { academicYearId } }),
      countOfferings({ academicYearId }),
      findAcademicYearOfferingGradeCounts(academicYearId),
      countOfferings({ academicYearId, curriculumStatus: "PROVISIONAL_DEPED" }),
      countOfferings({ academicYearId, curriculumStatus: "SCHOOL_APPROVED" }),
    ]);

  assert.ok(allCount > activeCount);
  assert.equal(
    gradeCounts.reduce((total, item) => total + item._count._all, 0),
    activeCount,
  );
  assert.ok(gradeCounts.every(({ gradeLevel }) => Number(gradeLevel) >= 7));
  assert.ok(provisionalCount >= 0);
  assert.ok(approvedCount >= 0);
});

test("missing SHS context blocks finalization even when no Offering is provisional", () => {
  const summary = buildAcademicYearConfigurationSummary(
    buildInput({
      academicYear: {
        ...buildInput().academicYear,
        status: "ACTIVE",
      },
      curriculum: {
        ...buildInput().curriculum,
        provisionalShsOfferingCount: 0,
        pendingShsOfferingCount: 1,
      },
    }),
  );

  assert.equal(summary.curriculum.pendingShsOfferingCount, 1);
  assert.equal(
    summary.notices.find(({ code }) => code === "SHS_CURRICULUM_NOT_FINALIZABLE")?.severity,
    "BLOCKER",
  );
});

test("Term activation blocker exactly follows the existing three chronological Terms rule", () => {
  const ready = buildAcademicYearConfigurationSummary(buildInput());
  const missing = buildAcademicYearConfigurationSummary(
    buildInput({
      academicYear: {
        ...buildInput().academicYear,
        terms: [term(1), term(2)],
      },
    }),
  );
  const unordered = buildAcademicYearConfigurationSummary(
    buildInput({
      academicYear: {
        ...buildInput().academicYear,
        terms: [term(2), term(1), term(3)],
      },
    }),
  );

  assert.equal(ready.activation.termsReady, true);
  assert.equal(missing.activation.termsReady, false);
  assert.equal(unordered.activation.termsReady, false);
  assert.equal(
    ready.notices.some(({ severity }) => severity === "BLOCKER"),
    false,
  );
  assert.equal(
    missing.notices.find(({ code }) => code === "TERMS_NOT_ACTIVATABLE")?.severity,
    "BLOCKER",
  );
});

test("Elective coverage reports exact configured and missing Term-grade scopes", () => {
  const policies = [
    { academicTermId: "term-1", gradeLevel: "11" },
    { academicTermId: "term-1", gradeLevel: "12" },
  ] as BuilderInput["electivePolicies"];
  const summary = buildAcademicYearConfigurationSummary(
    buildInput({ electivePolicies: policies }),
  );

  assert.equal(summary.electivePolicies.totalScopeCount, 6);
  assert.equal(summary.electivePolicies.configuredScopeCount, 2);
  assert.equal(summary.electivePolicies.missingScopes.length, 4);
  assert.equal(
    summary.notices.find(({ code }) => code === "MISSING_ELECTIVE_POLICIES")?.severity,
    "WARNING",
  );
});

test("authorized result-policy summary preserves missing, DRAFT, and PUBLISHED semantics", () => {
  const missing = buildAcademicYearConfigurationSummary(
    buildInput({ includeResultPolicy: true, resultPolicy: null }),
  );
  const draft = buildAcademicYearConfigurationSummary(
    buildInput({
      includeResultPolicy: true,
      resultPolicy: {
        status: "DRAFT",
        passingThreshold: 75,
        sourceReference: "Draft reference",
        publishedAt: null,
      } as unknown as BuilderInput["resultPolicy"],
    }),
  );
  const published = buildAcademicYearConfigurationSummary(
    buildInput({
      includeResultPolicy: true,
      resultPolicy: {
        status: "PUBLISHED",
        passingThreshold: 75,
        sourceReference: "Published reference",
        publishedAt: new Date(),
      } as unknown as BuilderInput["resultPolicy"],
    }),
  );

  assert.equal(missing.resultInterpretationPolicy, null);
  assert.equal(draft.resultInterpretationPolicy?.status, "DRAFT");
  assert.equal(published.resultInterpretationPolicy?.status, "PUBLISHED");
  assert.ok(
    [missing, draft, published].every(
      (summary) =>
        summary.notices.find(({ code }) => code === "RESULT_POLICY_STATUS")
          ?.severity === "INFORMATION",
    ),
  );
});

test("historical configuration gaps are informational rather than actionable", () => {
  const summary = buildAcademicYearConfigurationSummary(
    buildInput({
      academicYear: {
        ...buildInput().academicYear,
        status: "ARCHIVED",
        terms: [],
      },
      curriculum: {
        activeOfferingCount: 0,
        gradeCounts: [],
        provisionalShsOfferingCount: 0,
        pendingShsOfferingCount: 0,
        schoolApprovedShsOfferingCount: 0,
        controlledCorrectionCount: 0,
      },
    }),
  );

  assert.ok(summary.notices.every(({ severity }) => severity === "INFORMATION"));
});

test("non-draft Term anomalies are informational and do not imply reactivation", () => {
  const summary = buildAcademicYearConfigurationSummary(
    buildInput({
      academicYear: {
        ...buildInput().academicYear,
        status: "ACTIVE",
        terms: [],
      },
    }),
  );
  const termNotice = summary.notices.find(
    ({ code }) => code === "TERMS_NOT_ACTIVATABLE",
  );

  assert.equal(termNotice?.severity, "INFORMATION");
  assert.match(termNotice?.message ?? "", /existing lifecycle state is unchanged/);
});

test("Academic Year modal composes sections, focused policies, lifecycle gates, and canonical links", async () => {
  const [view, manager, page, termManager] = await Promise.all([
    readSource("app/(protected)/dashboard/academic-years/components/academic-year-view-dialog.tsx"),
    readSource("app/(protected)/dashboard/academic-years/components/academic-year-dialog-manager.tsx"),
    readSource("app/(protected)/dashboard/academic-years/page.tsx"),
    readSource("app/(protected)/dashboard/academic-years/components/academic-term-manager.tsx"),
  ]);

  for (const heading of [
    "Overview",
    "Academic Terms",
    "Curriculum",
    "SHS Configuration",
    "Operational Readiness",
  ]) {
    assert.match(view, new RegExp(`title=\\"${heading}\\"`));
  }
  assert.match(view, /useAcademicYearConfigurationSummary\(academicYear\.id, open\)/);
  assert.match(view, /CURRICULUM_ROUTE/);
  assert.match(view, /\?academicYearId=/);
  assert.match(view, /overview\.status === "DRAFT" && canAdoptCurriculum/);
  assert.doesNotMatch(view, /ShsElectiveEnrollmentPolicyManager/);
  assert.doesNotMatch(view, /ShsTermResultInterpretationPolicyManager/);
  assert.match(manager, /ShsElectiveEnrollmentPolicyDialog/);
  assert.match(manager, /ShsTermResultInterpretationPolicyDialog/);
  assert.match(page, /hasPermission\([\s\S]*Permissions\.SUBJECTS/);
  assert.match(page, /hasPermission\([\s\S]*Permissions\.GRADES/);
  assert.doesNotMatch(page, /role === "SUPER_ADMIN"/);
  assert.match(termManager, /Unable to load Academic Terms/);
  assert.match(termManager, /No terms configured/);
});

test("configuration-summary invalidation stays tied to affected Academic Year mutations", async () => {
  const [shared, term, offering, adoption, elective, interpretation] =
    await Promise.all([
      readSource("hooks/query-invalidation.ts"),
      readSource("hooks/academic-term.hook.ts"),
      readSource("hooks/subject-offering.hook.ts"),
      readSource("hooks/curriculum-adoption.hook.ts"),
      readSource("hooks/shs-elective-enrollment-policy.hook.ts"),
      readSource("hooks/shs-term-result-interpretation-policy.hook.ts"),
    ]);

  assert.match(shared, /\["academic-year-configuration"/);
  assert.match(term, /invalidateAcademicTermQueries/);
  for (const hook of [offering, adoption, elective, interpretation]) {
    assert.match(hook, /invalidateAcademicYearConfigurationQueries/);
  }
  assert.match(adoption, /values\.destinationAcademicYearId/);
  assert.doesNotMatch(shared, /student-subject-enrollments/);
});

test("Phase 21E-C adds no route or domain-model behavior", async () => {
  const [schema, view, adoption, lifecycle] = await Promise.all([
    readSource("prisma/schema.prisma"),
    readSource("app/(protected)/dashboard/academic-years/components/academic-year-view-dialog.tsx"),
    readSource("services/curriculum-adoption.service.ts"),
    readSource("services/academic-year.service.ts"),
  ]);

  assert.doesNotMatch(view, /\/dashboard\/academic-years\//);
  assert.match(adoption, /destinationYear\.status !== "DRAFT"/);
  assert.match(lifecycle, /hasThreeChronologicallyOrderedTerms/);
  assert.doesNotMatch(schema, /TermEnrollment/);
});
