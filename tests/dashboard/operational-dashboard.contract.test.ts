import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { hasPermission, Permissions } from "../../lib/permissions";
import { getStudentStatusSummary } from "../../repositories/dashboard.repository";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("operational dashboard permission is narrow and role-scoped", () => {
  assert.equal(hasPermission("SUPER_ADMIN", Permissions.OPERATIONAL_DASHBOARD), true);
  assert.equal(hasPermission("REGISTRAR", Permissions.OPERATIONAL_DASHBOARD), true);
  assert.equal(hasPermission("PRINCIPAL", Permissions.OPERATIONAL_DASHBOARD), false);
  assert.equal(hasPermission("TEACHER", Permissions.OPERATIONAL_DASHBOARD), false);
  assert.equal(hasPermission("REGISTRAR", Permissions.DASHBOARD), false);

  const proxy = source("proxy.ts");
  assert.match(proxy, /path: "\/dashboard",[\s\S]*permission: Permissions\.OPERATIONAL_DASHBOARD,[\s\S]*exact: true/);
});

test("dashboard action and service independently require operational access", () => {
  const action = source("actions/dashboard.action.ts");
  const service = source("services/dashboard.service.ts");
  assert.match(action, /requirePermission\(Permissions\.OPERATIONAL_DASHBOARD\)/);
  assert.match(service, /requirePermission\(Permissions\.OPERATIONAL_DASHBOARD\)/);
  assert.match(service, /TransactionIsolationLevel\.RepeatableRead/);
});

test("active-year aggregate filters exclude inactive and archived operational records", () => {
  const repository = source("repositories/dashboard.repository.ts");
  assert.match(repository, /academicYearId,[\s\S]*status: "ACTIVE"[\s\S]*deletedAt: null/);
  assert.match(repository, /student: \{ deletedAt: null, status: "ENROLLED"/);
  assert.match(repository, /section: \{ deletedAt: null \}/);
  assert.match(repository, /user: \{ is: \{ deletedAt: null, status: "ACTIVE" \} \}/);
  assert.match(repository, /gradeLevel: \{ in: \["11", "12"\] \}/);
  assert.match(repository, /curriculumStatus: "SCHOOL_APPROVED"/);
});

test("read model preserves zero grade buckets and avoids indeterminate policy counts", () => {
  const service = source("services/dashboard.service.ts");
  assert.match(service, /const gradeLevels = \["7", "8", "9", "10", "11", "12"\]/);
  assert.match(service, /missingElectivePolicies: termsReady/);
  assert.match(service, /state: "NOT_DETERMINABLE"/);
  assert.match(service, /NO_ACTIVE_ACADEMIC_YEAR/);
  assert.match(service, /toISOString\(\)/);
});

test("privileged activity is capability-gated and correction projection omits evidence", () => {
  const service = source("services/dashboard.service.ts");
  const repository = source("repositories/dashboard.repository.ts");
  assert.match(service, /capabilities\.results \? getDashboardResultData/);
  assert.match(service, /capabilities\.audit \? findRecentDashboardAuditActivity/);
  assert.match(service, /capabilities\.corrections \? findDashboardCorrections/);
  assert.doesNotMatch(repository, /reason:[\s\S]*findDashboardCorrections/);
  assert.doesNotMatch(repository, /evidenceReference:[\s\S]*findDashboardCorrections/);
});

test("dashboard UI has explicit loading, error, no-active-year, and zero-safe bars", () => {
  const component = source("components/dashboard/operational-dashboard.tsx");
  assert.match(component, /DashboardSkeleton/);
  assert.match(component, /Unable to load the operational dashboard/);
  assert.match(component, /No active Academic Year/);
  assert.match(component, /Math\.max\(1, \.\.\.values\.map/);
  assert.doesNotMatch(component, /NaN|Infinity/);
});

test("dashboard visualizations use accessible shadcn Recharts primitives with explicit zero states", () => {
  const component = source("components/dashboard/operational-dashboard.tsx");
  assert.match(component, /from "recharts"/);
  assert.match(component, /ChartContainer/);
  assert.match(component, /<BarChart accessibilityLayer/);
  assert.match(component, /<PieChart accessibilityLayer>/);
  assert.match(component, /const total = data\.reduce/);
  assert.match(component, /if \(total === 0\)/);
  assert.match(component, /Students by Grade Level/);
  assert.match(component, /Enrollments: JHS vs SHS/);
  assert.match(component, /Student Status/);
  assert.match(component, /SHS Result Status/);
  assert.match(component, /Top 10 Sections by Active Enrollment/);
});

test("student status summary counts each non-archived Student status once", async () => {
  const summary = await getStudentStatusSummary({
    student: {
      groupBy: async () => [
        { status: "ENROLLED", _count: { _all: 4 } },
        { status: "UNENROLLED", _count: { _all: 3 } },
        { status: "TRANSFERRED", _count: { _all: 2 } },
        { status: "DROPPED", _count: { _all: 1 } },
      ],
    },
  } as never);

  assert.deepEqual(summary, {
    enrolled: 4,
    unenrolled: 3,
    transferred: 2,
    dropped: 1,
  });

  const repository = source("repositories/dashboard.repository.ts");
  assert.match(repository, /student\.groupBy\(/);
  assert.match(repository, /deletedAt: null/);
  assert.match(repository, /status: \{ in: \["ENROLLED", "UNENROLLED", "TRANSFERRED", "DROPPED"\] \}/);
});

test("Student status remains a system summary while active-year metrics retain no-active-year behavior", () => {
  const synchronization = source("services/enrollment-synchronization.service.ts");
  const service = source("services/dashboard.service.ts");
  assert.match(synchronization, /findLatestActiveEnrollmentByStudent/);
  assert.match(synchronization, /status = "TRANSFERRED"/);
  assert.match(synchronization, /status = "DROPPED"/);
  assert.match(synchronization, /status = "UNENROLLED"/);
  assert.match(service, /state: "NO_ACTIVE_ACADEMIC_YEAR"/);
  assert.match(service, /studentStatusSummary/);
});

test("section distribution is capped at ten and View all is paginated", () => {
  const repository = source("repositories/dashboard.repository.ts");
  const component = source("components/dashboard/operational-dashboard.tsx");
  const service = source("services/dashboard.service.ts");
  assert.match(repository, /take: 10/);
  assert.match(repository, /function findActiveDashboardGradeCounts/);
  assert.match(service, /for \(const \{ gradeLevel, count \} of aggregates\.gradeCounts\)/);
  assert.match(repository, /const pageSize = 25/);
  assert.match(repository, /skip: \(page - 1\) \* pageSize/);
  assert.match(component, /Top 10 Sections by Active Enrollment/);
  assert.match(component, /View all \{total\} Sections/);
  assert.match(component, /paginated 25 Sections at a time/);
  assert.doesNotMatch(component, /data\.distributions\.sections/);
});
