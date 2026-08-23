"use client";

import { useState } from "react";
import { toast } from "sonner";

import { AcademicTermBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type ShsCurrentTermProgressionContext,
  useProgressShsCurrentTerm,
  useShsCurrentTermProgression,
} from "@/hooks/student-subject-enrollment.hook";

type ProgressionDetails = Extract<
  ShsCurrentTermProgressionContext,
  { currentElectiveOfferingIds: string[] }
>;

function hasProgressionDetails(
  context: ShsCurrentTermProgressionContext,
): context is ProgressionDetails {
  return "currentElectiveOfferingIds" in context;
}

export function ShsCurrentTermSubjectSelection({
  enrollmentId,
  gradeLevel,
  enrollmentStatus,
  academicYearStatus,
  open,
}: {
  enrollmentId: string;
  gradeLevel: string;
  enrollmentStatus: "ACTIVE" | "COMPLETED" | "DROPPED" | "TRANSFERRED";
  academicYearStatus: "DRAFT" | "ACTIVE" | "LOCKED" | "ARCHIVED";
  open: boolean;
}) {
  const [newOfferingIds, setNewOfferingIds] = useState<string[]>([]);
  const progression = useShsCurrentTermProgression(
    enrollmentId,
    open && (gradeLevel === "11" || gradeLevel === "12"),
  );
  const saveProgression = useProgressShsCurrentTerm(enrollmentId);

  if (gradeLevel !== "11" && gradeLevel !== "12") return null;

  const context = progression.data;
  const details = context && hasProgressionDetails(context) ? context : null;
  const existingOfferingIds = details?.currentElectiveOfferingIds ?? [];
  const validNewOfferingIds = newOfferingIds.filter((id) => details?.eligibleElectives.some((offering) => offering.id === id && !offering.selected && !offering.dropped));
  const selectedCount = (details?.currentElectiveCount ?? 0) + validNewOfferingIds.length;
  const selectionWithinPolicy = details?.policy
    ? selectedCount >= details.policy.minimumElectives &&
      selectedCount <= details.policy.maximumElectives
    : false;
  const parentOperational =
    enrollmentStatus === "ACTIVE" && academicYearStatus === "ACTIVE";

  function toggleNewOffering(offeringId: string, checked: boolean) {
    setNewOfferingIds((current) =>
      checked
        ? [...current, offeringId]
        : current.filter((id) => id !== offeringId),
    );
  }

  async function submit() {
    try {
      const result = await saveProgression.mutateAsync({
        enrollmentId,
        subjectOfferingIds: [...existingOfferingIds, ...validNewOfferingIds],
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      setNewOfferingIds([]);
    } catch {
      toast.error("Unable to save current-Term SHS participation. Try again.");
    }
  }

  return (
    <section className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <h3 className="font-semibold">Current-Term SHS Subject Selection</h3>
        <p className="text-sm text-muted-foreground">
          Existing participation is read-only. Saving only adds selected
          school-approved electives for the server-resolved current Term.
        </p>
      </div>

      {progression.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : progression.isError ? (
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">Unable to load SHS progression details.</p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => void progression.refetch()}
            disabled={progression.isFetching}
          >
            {progression.isFetching ? "Retrying..." : "Try again"}
          </Button>
        </div>
      ) : context ? (
        <>
          <div className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-2 lg:grid-cols-4">
            <TermDetail
              label="Server Current Term"
              term={"currentTerm" in context ? context.currentTerm : null}
            />
            <TermDetail
              label="Entry Term"
              term={"entryTerm" in context ? context.entryTerm : null}
            />
            <Detail
              label="Elective Policy"
              value={
                details?.policy
                  ? `${details.policy.minimumElectives}-${details.policy.maximumElectives} electives`
                  : "Not configured"
              }
            />
            <Detail
              label="Current Electives"
              value={
                details?.policy
                  ? `${details.currentElectiveCount} of ${details.policy.minimumElectives}-${details.policy.maximumElectives}`
                  : String(details?.currentElectiveCount ?? 0)
              }
            />
            <Detail
              label="Core State"
              value={
                details
                  ? `${details.core.activeCount} active / ${details.core.eligibleCount} eligible`
                  : "Unavailable"
              }
            />
          </div>

          {!context.ready && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">Selection blocked</p>
              <p className="mt-1 text-muted-foreground">{context.reason}</p>
            </div>
          )}

          {details && (
            <div className="space-y-2">
              <div>
                <h4 className="font-medium">Eligible Current-Term Electives</h4>
                <p className="text-sm text-muted-foreground">
                  Dropped choices cannot be selected again. Omitted active rows
                  remain attached and are never removed by this action.
                </p>
              </div>
              {details.eligibleElectives.length ? (
                details.eligibleElectives.map((offering) => {
                  const checked =
                    offering.selected || newOfferingIds.includes(offering.id);
                  const disabled =
                    !context.ready ||
                    offering.selected ||
                    offering.dropped ||
                    (!checked &&
                      Boolean(
                        details.policy &&
                          selectedCount >= details.policy.maximumElectives,
                      )) ||
                    saveProgression.isPending;

                  return (
                    <div
                      key={offering.id}
                      className="flex gap-3 rounded-md border bg-background p-3"
                    >
                      {parentOperational && (
                        <Checkbox
                          aria-label={`Select ${offering.subjectCode} for the current Term`}
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(value) =>
                            toggleNewOffering(offering.id, value === true)
                          }
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-medium">
                            {offering.subjectCode}
                          </span>
                          {offering.selected && <Badge>Active</Badge>}
                          {offering.dropped && (
                            <Badge variant="destructive">Dropped</Badge>
                          )}
                          <Badge variant="outline">
                            {offering.shsContext?.classification}
                          </Badge>
                        </div>
                        <p className="mt-1">{offering.subjectDescription}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {offering.shsContext?.cluster
                            ? `${offering.shsContext.cluster.code} | ${offering.shsContext.cluster.name}`
                            : "No elective cluster"}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
                  No eligible school-approved electives cover the current Term.
                </div>
              )}
            </div>
          )}

          {details && (
            <div className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {selectedCount} current-Term elective
                {selectedCount === 1 ? "" : "s"} after saving.
              </p>
              {parentOperational && (
                <Button
                  size="sm"
                  disabled={
                    !context.ready ||
                    validNewOfferingIds.length === 0 ||
                    !selectionWithinPolicy ||
                    saveProgression.isPending
                  }
                  onClick={() => void submit()}
                >
                  {saveProgression.isPending
                    ? "Saving..."
                    : `Add ${validNewOfferingIds.length} selected`}
                </Button>
              )}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function TermDetail({
  label,
  term,
}: {
  label: string;
  term?: { name: string; position: number } | null;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      {term ? (
        <AcademicTermBadge position={term.position} name={term.name} />
      ) : (
        <p>Not available</p>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}
