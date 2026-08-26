"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  useCorrectStudentEnrollmentGradePlacement,
  useCorrectStudentEnrollmentPlacement,
  useStudentEnrollmentCorrectionContext,
  useStudentEnrollmentGradeCorrectionPreview,
} from "@/hooks/enrollment.hook";
import type {
  EnrollmentListItem,
  StudentEnrollmentCorrectionContext,
} from "@/schemas";

function hasCorrectionDestinations(
  value: unknown,
): value is StudentEnrollmentCorrectionContext {
  return typeof value === "object" && value !== null &&
    "destinations" in value && Array.isArray(value.destinations);
}

export function CorrectEnrollmentPlacementDialog({
  enrollment,
  open,
  onOpenChange,
}: {
  enrollment: EnrollmentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const contextQuery = useStudentEnrollmentCorrectionContext(
    enrollment.id,
    open,
  );
  const context = hasCorrectionDestinations(contextQuery.data)
    ? contextQuery.data
    : undefined;

  if (!open || !context) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92dvh] w-[96vw] max-w-4xl! flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Correct Placement</DialogTitle>
            <DialogDescription>
              Load the controlled placement correction context before selecting a destination Section.
            </DialogDescription>
          </DialogHeader>
          {contextQuery.isError || contextQuery.data !== undefined ? (
            <p className="text-sm text-destructive" role="alert">
              Unable to load placement correction context.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading placement context...
            </p>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <ReadyCorrectEnrollmentPlacementDialog
      enrollment={enrollment}
      context={context}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

function ReadyCorrectEnrollmentPlacementDialog({
  enrollment,
  context,
  open,
  onOpenChange,
}: {
  enrollment: EnrollmentListItem;
  context: StudentEnrollmentCorrectionContext;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const correction = useCorrectStudentEnrollmentPlacement();
  const gradeCorrection = useCorrectStudentEnrollmentGradePlacement();
  const [destinationSectionId, setDestinationSectionId] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const destination = context.destinations.find(
    (section) => section.id === destinationSectionId,
  );
  const isDifferentGrade = Boolean(
    destination && destination.gradeLevel !== context.gradeLevel,
  );
  const previewQuery = useStudentEnrollmentGradeCorrectionPreview(
    enrollment.id,
    destinationSectionId,
    open && isDifferentGrade,
  );
  const preview = isDifferentGrade &&
      previewQuery.data?.destinationSectionId === destinationSectionId
    ? previewQuery.data
    : undefined;
  const isPending = correction.isPending || gradeCorrection.isPending;
  const trimmedReason = reason.trim();
  const trimmedEvidence = evidenceReference.trim();
  const hasPreviewResultBlockers = Boolean(preview?.resultBlockers.length);
  const commonInvalid = !destination || !trimmedReason ||
    !trimmedEvidence || reason.length > 500 ||
    evidenceReference.length > 500 || !confirmed;
  const gradeCorrectionInvalid = commonInvalid || !previewQuery.isSuccess || !preview ||
    !preview.eligible || preview.blockers.length > 0 ||
    hasPreviewResultBlockers ||
    (preview.requiresTypedConfirmation &&
      typedConfirmation !== preview.typedConfirmationPhrase);

  async function submit() {
    if (!destination) return;

    if (isDifferentGrade) {
      const result = await gradeCorrection.mutateAsync({
        id: enrollment.id,
        values: {
          sourceSectionId: context.currentSectionId,
          destinationSectionId,
          reason: trimmedReason,
          evidenceReference: trimmedEvidence,
          typedConfirmation,
          confirmed,
        },
      });
      if (result.error) {
        toast.error(result.error);
        await previewQuery.refetch();
        return;
      }
      toast.success(result.success);
      onOpenChange(false);
      return;
    }

    const result = await correction.mutateAsync({
      id: enrollment.id,
      values: {
        sourceSectionId: context.currentSectionId,
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

  const options = context.destinations.map((section) => ({
    value: section.id,
    label: `Grade ${section.gradeLevel} - ${section.sectionName}`,
    searchValue: `${section.gradeLevel} ${section.sectionName}`,
  }));

  const title = isDifferentGrade
    ? "Grade-Level Correction Review"
    : "Correct Placement";

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => !isPending && onOpenChange(value)}
    >
      <DialogContent className="flex max-h-[92dvh] w-[96vw] max-w-4xl! flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 pt-5 pb-4 sm:px-6 sm:pt-6">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isDifferentGrade ? (
              <>Review the permanent grade-level correction and its historical and derived subject records before confirming.</>
            ) : (
              <>Correct an administrative same-grade Section mistake. This audited correction preserves Enrollment identity, subject participation, Term memberships, results, lifecycle, and entry facts.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 px-4 py-5 sm:px-6">
          <div className="space-y-5">
            <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Section</p>
                <p className="font-medium">{context.currentSection}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Grade Level</p>
                <p className="font-medium">
                  Grade {context.gradeLevel}
                  {isDifferentGrade && destination
                    ? ` to Grade ${destination.gradeLevel}`
                    : ""}
                </p>
                {!isDifferentGrade ? (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-300">Grade is not changing.</p>
                ) : null}
              </div>
              {!isDifferentGrade ? <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">
                  Informational only: {context.participationCount} subject participation record{context.participationCount === 1 ? "" : "s"}. Student Subject Enrollments, their Terms, and results will remain unchanged.
                </p>
              </div> : null}
            </div>

            <Field>
              <FieldLabel>Destination Section *</FieldLabel>
              <SearchableSelect
                value={destinationSectionId}
                onValueChange={(value) => {
                  setDestinationSectionId(value);
                  setTypedConfirmation("");
                  setConfirmed(false);
                }}
                options={options}
                placeholder={options.length ? "Select a destination Section" : "No destination Sections available"}
                disabled={!options.length || isPending}
              />
              <FieldDescription>Active regular JHS Sections are available. A different grade requires a separate review.</FieldDescription>
            </Field>

            {isDifferentGrade && destination ? (
              <GradeCorrectionReview
                isLoading={previewQuery.isLoading}
                isError={previewQuery.isError}
                preview={preview}
                sourceGrade={context.gradeLevel}
                sourceSection={context.currentSection}
                destinationGrade={destination.gradeLevel}
                destinationSection={destination.sectionName}
              />
            ) : null}

            <Field>
              <FieldLabel htmlFor="placement-correction-reason">Correction Reason *</FieldLabel>
              <Textarea
                id="placement-correction-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Explain the administrative placement mistake."
                disabled={isPending}
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
                disabled={isPending}
                required
              />
              <FieldDescription>Required, 1-500 characters.</FieldDescription>
            </Field>

            {isDifferentGrade && preview?.requiresTypedConfirmation ? (
              <Field>
                <FieldLabel htmlFor="grade-correction-confirmation">
                  Because an Academic Term has started, type <span className="font-mono">{preview.typedConfirmationPhrase}</span> to confirm *
                </FieldLabel>
                <Input
                  id="grade-correction-confirmation"
                  value={typedConfirmation}
                  onChange={(event) => setTypedConfirmation(event.target.value)}
                  autoComplete="off"
                  disabled={isPending}
                />
                <FieldDescription>The phrase must match exactly.</FieldDescription>
              </Field>
            ) : null}

            <label className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
                disabled={isPending}
              />
              {isDifferentGrade ? <span>
                I confirm this permanent, audited grade-level correction. Old
                subject participation, Term memberships, results, and Grades
                remain attached to the old grade history and will not be
                rewritten, moved, or deleted. New destination-grade subjects
                are derived separately as shown in this review.
              </span> : <span>
                I confirm this is a permanent, audited historical placement correction.
                Grade is not changing. Student Subject Enrollments, SSE Terms, and results
                will not change. This is not a subject correction, Curriculum correction,
                or DROP.
              </span>}
            </label>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none px-4 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
          <Button
            onClick={() => void submit()}
            disabled={isPending || (isDifferentGrade ? gradeCorrectionInvalid : commonInvalid)}
          >
            {isPending
              ? "Correcting..."
              : isDifferentGrade
                ? "Record Grade-Level Correction"
                : "Record Placement Correction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type GradeCorrectionPreview = NonNullable<
  ReturnType<typeof useStudentEnrollmentGradeCorrectionPreview>["data"]
>;

function GradeCorrectionReview({
  isLoading,
  isError,
  preview,
  sourceGrade,
  sourceSection,
  destinationGrade,
  destinationSection,
}: {
  isLoading: boolean;
  isError: boolean;
  preview: GradeCorrectionPreview | undefined;
  sourceGrade: string;
  sourceSection: string;
  destinationGrade: string;
  destinationSection: string;
}) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground" aria-live="polite">Loading grade-level correction preview...</p>;
  }

  if (isError || !preview) {
    return <p className="text-sm text-destructive" role="alert">Unable to load the grade-level correction preview.</p>;
  }

  const hasResultBlockers = preview.resultBlockers.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
        <PlacementFact label="Source placement" value={`Grade ${sourceGrade} - ${sourceSection}`} />
        <PlacementFact label="Destination placement" value={`Grade ${destinationGrade} - ${destinationSection}`} />
      </div>

      {preview.blockers.length > 0 || hasResultBlockers || !preview.eligible ? (
        <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">This grade-level correction cannot be recorded.</p>
            {preview.blockers.map((blocker) => <p key={blocker} className="mt-1">{blocker}</p>)}
            {hasResultBlockers ? (
              <p className="mt-1">Resolve the subject-level result blockers shown below.</p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>This changes the student&apos;s recorded grade and Section. Existing source-grade history remains immutable; destination-grade subject participation is derived as a separate result.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SubjectCoverage
          title="Historical source subjects"
          description="Preserved under the old grade history"
          subjects={preview.sourceSubjects}
          resultBlockers={preview.resultBlockers}
        />
        <SubjectCoverage
          title="Derived destination subjects"
          description="Created for the corrected destination grade"
          subjects={preview.destinationSubjects}
        />
      </div>
    </div>
  );
}

function SubjectCoverage({
  title,
  description,
  subjects,
  resultBlockers = [],
}: {
  title: string;
  description: string;
  subjects: GradeCorrectionPreview["sourceSubjects"];
  resultBlockers?: GradeCorrectionPreview["resultBlockers"];
}) {
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {subjects.length ? subjects.map((subject) => {
        const subjectResultBlockers = resultBlockers.filter(
          (blocker) => blocker.subjectCode === subject.subjectCode,
        );

        return <div key={`${subject.subjectCode}-${subject.gradeLevel}`} className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium">{subject.subjectCode} - {subject.subjectDescription}</p>
            <p className="text-xs text-muted-foreground">Grade {subject.gradeLevel}</p>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Term coverage">
            {subject.termNames.map((termName) => <Badge key={termName} variant="outline">{termName}</Badge>)}
            {!subject.termNames.length ? <span className="text-xs text-muted-foreground">No Term coverage</span> : null}
          </div>
          {subjectResultBlockers.length ? (
            <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive" role="alert">
              <p className="font-medium">Result blockers</p>
              {subjectResultBlockers.map((blocker) => (
                <p key={blocker.studentSubjectEnrollmentId}>
                  {blocker.resultCount} recorded result{blocker.resultCount === 1 ? "" : "s"} block replacement.
                </p>
              ))}
            </div>
          ) : null}
        </div>;
      }) : <p className="text-sm text-muted-foreground">No subjects in this preview.</p>}
    </section>
  );
}

function PlacementFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
