"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  School,
  Users,
  UserSquare2,
} from "lucide-react";

import { StatCard } from "@/components/dashboard/stat-card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOperationalDashboardSectionPage } from "@/hooks/dashboard-hook";
import type { DashboardReadModel, StudentStatusSummary } from "@/types/dashboard";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="h-20 animate-pulse rounded-2xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <div className="h-32 animate-pulse rounded-2xl bg-muted" key={index} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

const gradeChartConfig = {
  students: { label: "Students", color: "var(--chart-1)" },
} satisfies ChartConfig;

const enrollmentChartConfig = {
  jhs: { label: "JHS", color: "var(--chart-1)" },
  shs: { label: "SHS", color: "var(--chart-2)" },
} satisfies ChartConfig;

const studentStatusChartConfig = {
  enrolled: { label: "Enrolled", color: "var(--chart-1)" },
  unenrolled: { label: "Unenrolled", color: "var(--chart-2)" },
  transferred: { label: "Transferred", color: "var(--chart-3)" },
  dropped: { label: "Dropped", color: "var(--chart-4)" },
} satisfies ChartConfig;

const sectionChartConfig = {
  students: { label: "Students", color: "var(--chart-1)" },
} satisfies ChartConfig;

const resultChartConfig = {
  draft: { label: "Draft", color: "var(--chart-3)" },
  finalized: { label: "Finalized", color: "var(--chart-2)" },
  revised: { label: "Revised", color: "var(--chart-4)" },
} satisfies ChartConfig;

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-card p-5 shadow-sm"><h2 className="text-base font-semibold">{title}</h2>{children}</section>;
}

function CountLegend({ values }: { values: Array<{ label: string; count: number; color: string }> }) {
  return <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
    {values.map((item) => <div className="flex items-center justify-between gap-2" key={item.label}><dt className="flex items-center gap-2 text-muted-foreground"><span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</dt><dd className="font-medium tabular-nums">{item.count}</dd></div>)}
  </dl>;
}

function DonutChart({
  data,
  config,
  emptyMessage,
}: {
  data: Array<{ key: string; label: string; count: number; fill: string }>;
  config: ChartConfig;
  emptyMessage: string;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return <p className="mt-5 text-sm text-muted-foreground">{emptyMessage}</p>;

  return <ChartContainer config={config} className="mt-3 h-44 w-full">
    <PieChart accessibilityLayer>
      <ChartTooltip content={<ChartTooltipContent nameKey="key" labelKey="label" />} />
      <Pie data={data} dataKey="count" nameKey="key" innerRadius={48} outerRadius={70} strokeWidth={3}>
        {data.map((item) => <Cell fill={item.fill} key={item.key} />)}
        <Label content={({ viewBox }) => viewBox && "cx" in viewBox && "cy" in viewBox ? <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle"><tspan className="fill-foreground text-xl font-semibold">{total}</tspan><tspan x={viewBox.cx} dy="1.4em" className="fill-muted-foreground text-xs">Records</tspan></text> : null} />
      </Pie>
    </PieChart>
  </ChartContainer>;
}

function GradeChart({ values }: { values: Array<{ gradeLevel: string; count: number }> }) {
  const maximum = Math.max(1, ...values.map((value) => value.count));
  return <ChartCard title="Students by Grade Level"><ChartContainer config={gradeChartConfig} className="mt-4 h-56 w-full"><BarChart accessibilityLayer data={values.map((value) => ({ grade: `Grade ${value.gradeLevel}`, students: value.count }))}><CartesianGrid vertical={false} /><XAxis dataKey="grade" tickLine={false} tickMargin={8} axisLine={false} /><YAxis allowDecimals={false} domain={[0, maximum]} tickLine={false} axisLine={false} width={28} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="students" fill="var(--color-students)" radius={4} /></BarChart></ChartContainer></ChartCard>;
}

function EnrollmentChart({ jhs, shs }: { jhs: number; shs: number }) {
  const data = [{ key: "jhs", label: "JHS", count: jhs, fill: "var(--color-jhs)" }, { key: "shs", label: "SHS", count: shs, fill: "var(--color-shs)" }];
  return <ChartCard title="Enrollments: JHS vs SHS"><DonutChart data={data} config={enrollmentChartConfig} emptyMessage="No active enrollments in the active Academic Year." /><CountLegend values={[{ label: "JHS", count: jhs, color: "var(--chart-1)" }, { label: "SHS", count: shs, color: "var(--chart-2)" }]} /></ChartCard>;
}

function SectionChart({ values }: { values: Array<{ id: string; label: string; count: number }> }) {
  const maximum = Math.max(1, ...values.map((value) => value.count));
  if (values.length === 0) return <ChartCard title="Top 10 Sections by Active Enrollment"><p className="mt-5 text-sm text-muted-foreground">No active Sections have enrollments in this Academic Year.</p></ChartCard>;
  return <ChartCard title="Top 10 Sections by Active Enrollment"><ChartContainer config={sectionChartConfig} className="mt-4 h-[min(28rem,calc(8rem+2.2rem*var(--section-count)))] min-h-56 w-full" style={{ "--section-count": values.length } as React.CSSProperties}><BarChart accessibilityLayer data={values} layout="vertical" margin={{ left: 8 }}><CartesianGrid horizontal={false} /><XAxis type="number" allowDecimals={false} domain={[0, maximum]} tickLine={false} axisLine={false} /><YAxis type="category" dataKey="label" width={112} tickLine={false} axisLine={false} tickFormatter={(value) => value.length > 18 ? `${value.slice(0, 18)}…` : value} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="count" name="Students" fill="var(--color-students)" radius={4} /></BarChart></ChartContainer></ChartCard>;
}

function StudentStatusPanel({ summary }: { summary: StudentStatusSummary }) {
  const statuses = [
    { key: "enrolled", label: "Enrolled", count: summary.enrolled, fill: "var(--color-enrolled)", color: "var(--chart-1)" },
    { key: "unenrolled", label: "Unenrolled", count: summary.unenrolled, fill: "var(--color-unenrolled)", color: "var(--chart-2)" },
    { key: "transferred", label: "Transferred", count: summary.transferred, fill: "var(--color-transferred)", color: "var(--chart-3)" },
    { key: "dropped", label: "Dropped", count: summary.dropped, fill: "var(--color-dropped)", color: "var(--chart-4)" },
  ];

  return (
    <ChartCard title="Student Status">
      <div>
        <p className="mt-1 text-sm text-muted-foreground">System-wide non-archived Student records. Graduated records are not included.</p>
      </div>
      <DonutChart data={statuses} config={studentStatusChartConfig} emptyMessage="No non-archived Student status records." />
      <CountLegend values={statuses.map(({ label, count, color }) => ({ label, count, color }))} />
    </ChartCard>
  );
}

function SectionDistribution({
  sections,
  total,
}: {
  sections: Extract<DashboardReadModel, { state: "READY" }>["distributions"]["topSections"];
  total: number;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const sectionPage = useOperationalDashboardSectionPage(page, open);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil((sectionPage.data?.total ?? total) / pageSize));

  return <>
    <SectionChart values={sections.map((section) => ({ id: section.id, label: section.label, count: section.count }))} />
    {total > 10 && <div className="-mt-3 flex justify-end"><Button variant="outline" size="sm" onClick={() => { setPage(1); setOpen(true); }}>View all {total} Sections</Button></div>}
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Active-Year Sections</DialogTitle>
          <DialogDescription>Ranked by active enrollment. This list is scoped to the active Academic Year and paginated 25 Sections at a time.</DialogDescription>
        </DialogHeader>
        {sectionPage.isLoading ? <p className="py-8 text-sm text-muted-foreground">Loading Sections…</p> : sectionPage.isError ? <p className="py-8 text-sm text-destructive">Unable to load Sections.</p> : <div className="max-h-[50dvh] overflow-y-auto rounded-lg border"><table className="w-full text-sm"><thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Section</th><th className="px-3 py-2 text-right font-medium">Enrollments</th></tr></thead><tbody>{sectionPage.data?.records.map((section) => <tr className="border-t" key={section.id}><td className="px-3 py-2 font-medium break-words">{section.label}</td><td className="px-3 py-2 text-right tabular-nums">{section.count}</td></tr>)}</tbody></table>{sectionPage.data?.records.length === 0 && <p className="p-4 text-sm text-muted-foreground">No active-year Sections found.</p>}</div>}
        <DialogFooter>
          <p className="mr-auto self-center text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function ActivityList({
  title,
  children,
  emptyMessage,
}: {
  title: string;
  children: React.ReactNode;
  emptyMessage: string;
}) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <h2 className="text-base font-semibold">{title}</h2>
      {children || <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>}
    </section>
  );
}

function ReadyDashboard({ data }: { data: Extract<DashboardReadModel, { state: "READY" }> }) {
  const { summary } = data;
  const policyState = data.curriculumReadiness.missingElectivePolicies;
  const correctionItems = data.recentCorrections ?? [];
  const revisionItems = data.recentResultRevisions ?? [];
  const auditItems = data.recentAuditActivity ?? [];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">Active Academic Year</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{data.academicYear.label}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(data.academicYear.startDate)} to {formatDate(data.academicYear.endDate)}</p>
          </div>
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">{data.academicYear.status}</span>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Active Students" value={summary.activeStudentCount} icon={Users} description="Enrolled in the active Academic Year" />
        <StatCard title="Active Enrollments" value={summary.activeEnrollmentCount} icon={ClipboardList} description="Current active enrollment records" />
        <StatCard title="Active Teachers" value={summary.activeTeacherCount} icon={UserSquare2} description="System-wide active teacher accounts" />
        <StatCard title="Active Sections" value={summary.activeSectionCount} icon={School} description="With active-year enrollments" />
        <StatCard title="Curriculum Offerings" value={summary.activeOfferingCount} icon={BookOpen} description="Active Academic Year" />
        <StatCard title="Approved SHS Offerings" value={summary.schoolApprovedShsOfferingCount} icon={CheckCircle2} description="School-approved Grade 11-12" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GradeChart values={data.distributions.grades} />
        <EnrollmentChart jhs={summary.jhsEnrollmentCount} shs={summary.shsEnrollmentCount} />
      </div>

      <StudentStatusPanel summary={data.system.studentStatusSummary} />

      <SectionDistribution sections={data.distributions.topSections} total={summary.activeSectionCount} />

      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold">Curriculum Readiness</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-sm font-medium">SHS elective-policy scopes</p>
            {policyState.state === "NOT_DETERMINABLE" ? <p className="mt-1 text-sm text-muted-foreground">{policyState.message}</p> : policyState.missingScopes.length === 0 ? <p className="mt-1 text-sm text-emerald-700">All active-year Term and Grade 11-12 scopes are configured.</p> : <p className="mt-1 text-sm text-amber-700">{policyState.missingScopes.length} scope{policyState.missingScopes.length === 1 ? "" : "s"} missing: {policyState.missingScopes.map((scope) => `${scope.termName} Grade ${scope.gradeLevel}`).join(", ")}.</p>}
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-sm font-medium">Operational notices</p>
            {data.curriculumReadiness.warnings.length === 0 ? <p className="mt-1 text-sm text-emerald-700">No Curriculum readiness warnings.</p> : <ul className="mt-1 space-y-1 text-sm text-amber-700">{data.curriculumReadiness.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
          </div>
        </div>
      </section>

      {data.resultSummary && <ChartCard title="SHS Result Status"><DonutChart data={[{ key: "draft", label: "Draft", count: data.resultSummary.draftCount, fill: "var(--color-draft)" }, { key: "finalized", label: "Finalized", count: data.resultSummary.finalizedCount, fill: "var(--color-finalized)" }, { key: "revised", label: "Revised", count: data.resultSummary.revisedResultCount, fill: "var(--color-revised)" }]} config={resultChartConfig} emptyMessage="No SHS results are recorded for the active Academic Year." /><CountLegend values={[{ label: "Draft", count: data.resultSummary.draftCount, color: "var(--chart-3)" }, { label: "Finalized", count: data.resultSummary.finalizedCount, color: "var(--chart-2)" }, { label: "Revised", count: data.resultSummary.revisedResultCount, color: "var(--chart-4)" }]} /></ChartCard>}

      <div className="grid gap-6 xl:grid-cols-3">
        {data.capabilities.corrections && <ActivityList title="Recent Student Corrections" emptyMessage="No recent active-year student corrections.">{correctionItems.length > 0 && <ul className="mt-4 space-y-3">{correctionItems.map((item) => <li key={item.id} className="border-b pb-3 last:border-0"><p className="text-sm font-medium">{item.studentName}</p><p className="text-xs text-muted-foreground">{item.kind.replaceAll("_", " ")} · {formatDate(item.correctedAt)}</p></li>)}</ul>}</ActivityList>}
        {data.resultSummary && <ActivityList title="Recent Result Revisions" emptyMessage="No recent SHS result revisions.">{revisionItems.length > 0 && <ul className="mt-4 space-y-3">{revisionItems.map((item) => <li key={item.id} className="border-b pb-3 last:border-0"><p className="text-sm font-medium">{item.subjectDescription}</p><p className="text-xs text-muted-foreground">Revised {formatDate(item.revisedAt)}</p></li>)}</ul>}</ActivityList>}
        {data.capabilities.audit && <ActivityList title="Recent Administrative Activity (system-wide)" emptyMessage="No recent administrative activity.">{auditItems.length > 0 && <ul className="mt-4 space-y-3">{auditItems.map((item) => <li key={item.id} className="border-b pb-3 last:border-0"><p className="text-sm font-medium">{item.action} · {item.module}</p><p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p><p className="mt-1 text-xs text-muted-foreground">{item.actorName} · {formatDate(item.createdAt)}</p></li>)}</ul>}</ActivityList>}
      </div>
    </div>
  );
}

export function OperationalDashboard({ data, isLoading, isError, refetch }: UseQueryResult<DashboardReadModel>) {
  if (isLoading) return <DashboardSkeleton />;
  if (isError || !data) return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6"><h1 className="text-lg font-semibold">Unable to load the operational dashboard.</h1><p className="mt-1 text-sm text-muted-foreground">Try again to retrieve current Academic Year data.</p><button type="button" className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" onClick={() => void refetch()}>Retry</button></div>;
  if (data.state === "NO_ACTIVE_ACADEMIC_YEAR") return <div className="space-y-6"><div className="rounded-2xl border bg-card p-6 shadow-sm"><h1 className="text-xl font-semibold">No active Academic Year</h1><p className="mt-2 text-sm text-muted-foreground">Operational enrollment, Curriculum, and result metrics are unavailable until an Academic Year is activated.</p><p className="mt-5 text-sm"><span className="font-medium">Active Teachers:</span> {data.system.activeTeacherCount} <span className="text-muted-foreground">(system-wide)</span></p></div><StudentStatusPanel summary={data.system.studentStatusSummary} /></div>;
  return <ReadyDashboard data={data} />;
}
