"use client";

import { Badge } from "@/components/ui/badge";
import { useStudentEnrollmentCorrectionContext } from "@/hooks/enrollment.hook";
import { formatDateTime } from "@/lib/format";

export function StudentEnrollmentCorrectionHistory({ enrollmentId, open }: { enrollmentId: string; open: boolean }) {
  const { data, isLoading, isError } = useStudentEnrollmentCorrectionContext(enrollmentId, open);

  return (
    <section className="space-y-3 border-t pt-5">
      <div>
        <h3 className="font-semibold">Enrollment Correction History</h3>
        <p className="text-sm text-muted-foreground">Immutable placement and grade-level correction events for this Enrollment.</p>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading correction history...</p> : null}
      {isError ? <p className="text-sm text-destructive">Unable to load Enrollment correction history.</p> : null}
      {data && data.history.length === 0 ? <p className="text-sm text-muted-foreground">No Enrollment corrections recorded.</p> : null}
      <div className="space-y-3">
        {data?.history.map((correction) => (
          <article key={correction.id} className="rounded-lg border p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <Badge variant={correction.correctionType === "GRADE_LEVEL" ? "destructive" : "secondary"}>
                  {correction.correctionType === "GRADE_LEVEL" ? "Grade-Level" : "Placement"}
                </Badge>
                <p className="font-medium">{correction.sourceSection} &rarr; {correction.destinationSection}</p>
              </div>
              <p className="text-xs text-muted-foreground">{formatDateTime(correction.correctedAt)}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Corrected by {correction.correctedBy}</p>
            {correction.sourceParticipationCount != null || correction.replacementParticipationCount != null ? (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {correction.sourceParticipationCount != null ? (
                  <Badge variant="outline">{correction.sourceParticipationCount} historical source participation</Badge>
                ) : null}
                {correction.replacementParticipationCount != null ? (
                  <Badge variant="outline">{correction.replacementParticipationCount} replacement participation</Badge>
                ) : null}
              </div>
            ) : null}
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="font-medium">Reason</dt><dd className="break-words text-muted-foreground">{correction.reason}</dd></div>
              <div><dt className="font-medium">Evidence / Reference</dt><dd className="break-words text-muted-foreground">{correction.evidenceReference}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
