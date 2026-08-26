"use client";

import { Badge } from "@/components/ui/badge";
import { useShsStudentParticipationCorrectionHistory } from "@/hooks/enrollment.hook";
import { formatDateTime, formatFullName } from "@/lib/format";
import { getShsSubjectClassificationLabel } from "@/lib/shs-presentation";

export function ShsStudentParticipationCorrectionHistory({ enrollmentId, open }: { enrollmentId: string; open: boolean }) {
  const { data, isLoading, isError } = useShsStudentParticipationCorrectionHistory(enrollmentId, open);
  return <section className="space-y-3 border-t pt-5"><div><h3 className="font-semibold">SHS Subject Correction History</h3><p className="text-sm text-muted-foreground">Immutable subject-participation correction events, separate from placement history.</p></div>{isLoading ? <p className="text-sm text-muted-foreground">Loading subject correction history...</p> : null}{isError ? <p className="text-sm text-destructive">Unable to load SHS subject correction history.</p> : null}{data?.length === 0 ? <p className="text-sm text-muted-foreground">No SHS subject corrections recorded.</p> : null}<div className="space-y-3">{data?.map((event) => <article key={event.id} className="rounded-lg border p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><Badge variant="secondary">{getShsSubjectClassificationLabel(event.kind)}</Badge><p className="mt-2 font-medium">{event.sourceStudentSubjectEnrollment.subjectCode} &rarr; {event.replacementStudentSubjectEnrollment.subjectCode}</p></div><p className="text-xs text-muted-foreground">{formatDateTime(event.correctedAt)}</p></div><p className="mt-1 text-sm text-muted-foreground">{event.sourceAcademicTerm.name} to {event.replacementAcademicTerm.name} | corrected by {formatFullName(event.correctedBy.firstName, event.correctedBy.middleName, event.correctedBy.lastName)}</p><p className="mt-3 text-sm"><span className="font-medium">Reason:</span> {event.reason}</p><p className="mt-1 text-sm text-muted-foreground break-words">Evidence: {event.evidenceReference}</p></article>)}</div></section>;
}
