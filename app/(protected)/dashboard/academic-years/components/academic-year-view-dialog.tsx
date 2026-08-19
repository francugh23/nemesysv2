"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CircleAlert,
  Copy,
  Info,
  LockKeyhole,
  Settings2,
  TriangleAlert,
} from "lucide-react";

import { AcademicTermManager } from "./academic-term-manager";
import { AcademicYearStatusBadge } from "./academic-year-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAcademicYearConfigurationSummary } from "@/hooks/academic-year.hook";
import { CURRICULUM_ROUTE } from "@/lib/academic-configuration";
import { formatDateOnly, formatDateTime } from "@/lib/format";
import type { AcademicYearListItem } from "@/schemas";

export function AcademicYearViewDialog({
  academicYear,
  open,
  onOpenChange,
  canAdoptCurriculum = false,
  canManageElectivePolicy = false,
  canManageInterpretationPolicy = false,
  onAdoptCurriculum,
  onManageElectivePolicy,
  onManageInterpretationPolicy,
}: {
  academicYear: AcademicYearListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canAdoptCurriculum?: boolean;
  canManageElectivePolicy?: boolean;
  canManageInterpretationPolicy?: boolean;
  onAdoptCurriculum?: (academicYear: AcademicYearListItem) => void;
  onManageElectivePolicy?: (academicYear: AcademicYearListItem) => void;
  onManageInterpretationPolicy?: (academicYear: AcademicYearListItem) => void;
}) {
  const summaryQuery = useAcademicYearConfigurationSummary(academicYear.id, open);
  const summary = summaryQuery.data;
  const overview = summary?.academicYear ?? academicYear;
  const historical =
    overview.status === "LOCKED" || overview.status === "ARCHIVED";
  const resultPolicy =
    summary && "resultInterpretationPolicy" in summary
      ? summary.resultInterpretationPolicy
      : undefined;
  const canOpenResultPolicy =
    overview.status === "ACTIVE" || Boolean(resultPolicy);
  const canEditResultPolicy =
    overview.status === "ACTIVE" && resultPolicy?.status !== "PUBLISHED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-4xl! flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pt-6 pb-4">
          <DialogTitle>Academic Year Details</DialogTitle>
          <DialogDescription>
            Review this Academic Year&apos;s Terms, Curriculum, SHS configuration,
            and operational readiness.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 px-4 py-5 sm:px-6">
            <section aria-labelledby="academic-year-overview" className="space-y-4">
              <SectionHeading
                id="academic-year-overview"
                title="Overview"
                description="Canonical period identity and lifecycle context."
              />
              <div className="rounded-xl border bg-muted/20 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold">{overview.label}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDateOnly(overview.startDate)} to{" "}
                      {formatDateOnly(overview.endDate)}
                    </p>
                  </div>
                  <AcademicYearStatusBadge status={overview.status} />
                </div>

                {historical && (
                  <div className="mt-4 flex gap-3 rounded-lg border bg-background px-4 py-3 text-sm">
                    <LockKeyhole className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <p>
                      This is a historical, read-only view of the configuration
                      preserved for this {overview.status.toLowerCase()} Academic Year.
                    </p>
                  </div>
                )}

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <InfoItem label="Start Date" value={formatDateOnly(overview.startDate)} />
                  <InfoItem label="End Date" value={formatDateOnly(overview.endDate)} />
                  <InfoItem label="Created" value={formatDateTime(overview.createdAt)} subtle />
                  <InfoItem label="Last Updated" value={formatDateTime(overview.updatedAt)} subtle />
                </div>
              </div>
            </section>

            <section aria-labelledby="academic-year-terms" className="space-y-4">
              <SectionHeading
                id="academic-year-terms"
                title="Academic Terms"
                description="Primary child configuration owned by this Academic Year."
              />
              <AcademicTermManager
                academicYearId={academicYear.id}
                isDraft={overview.status === "DRAFT"}
                terms={summary?.terms}
                isLoading={summaryQuery.isLoading}
                isError={summaryQuery.isError}
                onRetry={() => void summaryQuery.refetch()}
              />
            </section>

            <section aria-labelledby="academic-year-curriculum" className="space-y-4">
              <SectionHeading
                id="academic-year-curriculum"
                title="Curriculum"
                description="Year-specific Subject Offerings and existing SHS approval facts."
              />
              {summaryQuery.isError ? (
                <SummaryError onRetry={() => void summaryQuery.refetch()} />
              ) : summary ? (
                <div className="rounded-xl border p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric label="Active Offerings" value={summary.curriculum.activeOfferingCount} />
                    <Metric
                      label="Grades Represented"
                      value={summary.curriculum.representedGrades.length}
                    />
                    <Metric
                      label="Provisional SHS"
                      value={summary.curriculum.provisionalShsOfferingCount}
                    />
                    <Metric
                      label="School-Approved SHS"
                      value={summary.curriculum.schoolApprovedShsOfferingCount}
                    />
                  </div>

                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">Represented grades</p>
                    <div className="flex flex-wrap gap-2">
                      {summary.curriculum.representedGrades.length ? (
                        summary.curriculum.representedGrades.map((grade) => (
                          <Badge key={grade} variant="outline">
                            Grade {grade}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No grades are represented by active Curriculum.
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Representation is factual and does not assert Curriculum completeness.
                    </p>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap">
                    <Link
                      href={`${CURRICULUM_ROUTE}?academicYearId=${encodeURIComponent(academicYear.id)}`}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      <BookOpenCheck /> View Curriculum for this Academic Year
                      <ArrowRight />
                    </Link>
                    {overview.status === "DRAFT" && canAdoptCurriculum && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => onAdoptCurriculum?.(overview)}
                      >
                        <Copy /> Adopt Curriculum
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <SummaryLoading />
              )}
            </section>

            <section aria-labelledby="academic-year-shs" className="space-y-4">
              <SectionHeading
                id="academic-year-shs"
                title="SHS Configuration"
                description="Separate policy domains that do not define which subjects Curriculum offers."
              />
              <div className="grid gap-4 md:grid-cols-2">
                {canManageElectivePolicy && (
                  <div className="flex flex-col rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">Elective Policy</h3>
                        <p className="text-sm text-muted-foreground">
                          Controls how many electives may be selected per Term and SHS grade.
                        </p>
                      </div>
                      <Settings2 className="size-5 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="mt-4 flex-1">
                      {summaryQuery.isError ? (
                        <p className="text-sm text-destructive">
                          Unable to load elective-policy coverage.
                        </p>
                      ) : summary ? (
                        <>
                          <p className="text-2xl font-semibold tabular-nums">
                            {summary.electivePolicies.configuredScopeCount}/
                            {summary.electivePolicies.totalScopeCount}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Term and Grade 11/12 scopes configured
                          </p>
                          {summary.electivePolicies.missingScopes.length > 0 && (
                            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                              {summary.electivePolicies.missingScopes.length} scope
                              {summary.electivePolicies.missingScopes.length === 1 ? "" : "s"} missing
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Loading policy coverage...</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      className="mt-4 w-full sm:w-auto sm:self-start"
                      variant="outline"
                      onClick={() => onManageElectivePolicy?.(overview)}
                    >
                      {historical ? "View Elective Policies" : "Manage Elective Policies"}
                    </Button>
                  </div>
                )}

                {canManageInterpretationPolicy &&
                  summary &&
                  "resultInterpretationPolicy" in summary && (
                    <div className="flex flex-col rounded-xl border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold">Result Interpretation Policy</h3>
                          <p className="text-sm text-muted-foreground">
                            Interprets finalized SHS Term Results without changing evidence.
                          </p>
                        </div>
                        <Badge
                          variant={resultPolicy?.status === "PUBLISHED" ? "default" : "secondary"}
                        >
                          {resultPolicy?.status ?? "NOT CONFIGURED"}
                        </Badge>
                      </div>
                      <div className="mt-4 flex-1 space-y-1 text-sm">
                        {resultPolicy ? (
                          <>
                            <p>Passing threshold: {resultPolicy.passingThreshold}</p>
                            <p className="line-clamp-2 text-muted-foreground">
                              Reference: {resultPolicy.sourceReference}
                            </p>
                          </>
                        ) : (
                          <p className="text-muted-foreground">
                            Missing policy does not block result entry or finalization.
                          </p>
                        )}
                      </div>
                      {canOpenResultPolicy && (
                        <Button
                          type="button"
                          className="mt-4 w-full sm:w-auto sm:self-start"
                          variant="outline"
                          onClick={() =>
                            onManageInterpretationPolicy?.(overview)
                          }
                        >
                          {canEditResultPolicy
                            ? "Manage Interpretation Policy"
                            : "View Interpretation Policy"}
                        </Button>
                      )}
                      {overview.status === "DRAFT" && (
                        <p className="mt-4 text-xs text-muted-foreground">
                          Policy configuration becomes available after activation.
                        </p>
                      )}
                    </div>
                  )}
              </div>
            </section>

            <section aria-labelledby="academic-year-readiness" className="space-y-4">
              <SectionHeading
                id="academic-year-readiness"
                title="Operational Readiness"
                description="Factual notices only. Curriculum and policy notices do not change lifecycle enforcement."
              />
              {summaryQuery.isError ? (
                <SummaryError onRetry={() => void summaryQuery.refetch()} />
              ) : summary ? (
                <div className="space-y-2">
                  {summary.notices.map((notice) => (
                    <ReadinessNotice key={notice.code} notice={notice} />
                  ))}
                </div>
              ) : (
                <SummaryLoading />
              )}
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({
  id,
  title,
  description,
}: {
  id: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 id={id} className="text-base font-semibold">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function InfoItem({
  label,
  value,
  subtle = false,
}: {
  label: string;
  value: string;
  subtle?: boolean;
}) {
  return (
    <div className={subtle ? "text-muted-foreground" : undefined}>
      <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SummaryLoading() {
  return (
    <div className="rounded-xl border p-4 text-sm text-muted-foreground">
      Loading configuration summary...
    </div>
  );
}

function SummaryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-destructive">
        Unable to load the Academic Year configuration summary.
      </p>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

type Notice = NonNullable<
  ReturnType<typeof useAcademicYearConfigurationSummary>["data"]
>["notices"][number];

function ReadinessNotice({ notice }: { notice: Notice }) {
  const Icon =
    notice.severity === "BLOCKER"
      ? CircleAlert
      : notice.severity === "WARNING"
        ? TriangleAlert
        : Info;
  const className =
    notice.severity === "BLOCKER"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : notice.severity === "WARNING"
        ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        : "bg-muted/30 text-muted-foreground";

  return (
    <div className={`flex gap-3 rounded-lg border px-4 py-3 text-sm ${className}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">{notice.severity === "INFORMATION" ? "Information" : notice.severity}</p>
        <p>{notice.message}</p>
      </div>
    </div>
  );
}
