"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  useCorrectStudentEnrollmentPlacement,
  useStudentEnrollmentCorrectionContext,
} from "@/hooks/enrollment.hook";
import type { EnrollmentListItem } from "@/schemas";

export function CorrectEnrollmentPlacementDialog({
  enrollment,
  open,
  onOpenChange,
}: {
  enrollment: EnrollmentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: context, isLoading, isError } = useStudentEnrollmentCorrectionContext(
    enrollment.id,
    open,
  );
  const correction = useCorrectStudentEnrollmentPlacement();
  const [destinationSectionId, setDestinationSectionId] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const trimmedReason = reason.trim();
  const trimmedEvidence = evidenceReference.trim();
  const invalid = !destinationSectionId || !trimmedReason || !trimmedEvidence ||
    reason.length > 500 || evidenceReference.length > 500 || !confirmed;

  async function submit() {
    const result = await correction.mutateAsync({
      id: enrollment.id,
      values: {
        sourceSectionId: context!.currentSectionId,
        destinationSectionId,
        reason: trimmedReason,
        evidenceReference: trimmedEvidence,
        confirmed,
      },
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.success);
    onOpenChange(false);
  }

  const options = context?.destinations.map((section) => ({
    value: section.id,
    label: `Grade ${section.gradeLevel}${section.trackStrand ? ` - ${section.trackStrand}` : ""} - ${section.sectionName}`,
    searchValue: `${section.gradeLevel} ${section.trackStrand ?? ""} ${section.sectionName}`,
  })) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[96vw] max-w-2xl! flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
          <DialogTitle>Correct Placement</DialogTitle>
          <DialogDescription>
            Correct an administrative same-grade Section mistake. This audited
            correction preserves Enrollment identity, subject participation,
            Term memberships, results, lifecycle, and entry facts.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 px-4 py-5 sm:px-6">
          {isLoading ? <p className="text-sm text-muted-foreground">Loading placement context...</p> : null}
          {isError ? <p className="text-sm text-destructive">Unable to load placement correction context.</p> : null}
          {context ? (
            <div className="space-y-5">
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Section</p>
                <p className="font-medium">{context.currentSection}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Grade Level</p>
                <p className="font-medium">Grade {context.gradeLevel}</p>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Grade is not changing.</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">
                  Informational only: {context.participationCount} subject participation record{context.participationCount === 1 ? "" : "s"}. Student Subject Enrollments, their Terms, and results will remain unchanged.
                </p>
              </div>
            </div>

            <Field>
              <FieldLabel>Destination Section *</FieldLabel>
              <SearchableSelect
                value={destinationSectionId}
                onValueChange={setDestinationSectionId}
                options={options}
                placeholder={options.length ? "Select another same-grade Section" : "No same-grade destination Sections available"}
                disabled={!options.length || correction.isPending}
              />
              <FieldDescription>Only active Grade {context.gradeLevel} Sections are eligible.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="placement-correction-reason">Correction Reason *</FieldLabel>
              <Textarea
                id="placement-correction-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Explain the administrative placement mistake."
                disabled={correction.isPending}
                required
              />
              <FieldDescription>Required, 1-500 characters.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="placement-correction-evidence">Evidence / Reference *</FieldLabel>
              <Textarea
                id="placement-correction-evidence"
                value={evidenceReference}
                onChange={(event) => setEvidenceReference(event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Enrollment form, registrar record, memorandum, or other reference."
                disabled={correction.isPending}
                required
              />
              <FieldDescription>Required, 1-500 characters.</FieldDescription>
            </Field>

            <label className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                disabled={correction.isPending}
              />
              <span>
                I confirm this is a permanent, audited historical placement correction.
                Grade is not changing. Student Subject Enrollments, SSE Terms, and results
                will not change. This is not a subject correction, Curriculum correction,
                or DROP.
              </span>
            </label>
            </div>
          ) : null}
          </div>
        </ScrollArea>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none px-4 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={correction.isPending}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!context || invalid || correction.isPending}>
            {correction.isPending ? "Correcting..." : "Record Placement Correction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
