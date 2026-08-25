"use client";

import { useState } from "react";
import { toast } from "sonner";

import { AcademicTermBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
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
import {
  useFinalizeShsTermResult,
  useReviseFinalizedShsTermResult,
  useSaveShsTermResultDraft,
} from "@/hooks/student-subject-enrollment.hook";
import { getPhilippineCalendarDate } from "@/lib/academic-term-current";

export interface ShsTermResultTarget {
  studentSubjectEnrollmentId: string;
  subjectCode: string;
  subjectDescription: string;
  academicTermId: string;
  academicTerm: {
    name: string;
    position: number;
    endDate: Date;
  };
  result: {
    id: string;
    finalResult: number | null;
    originalFinalResult: number | null;
    authoritativeFinalResult: number | null;
    authoritativeSource: "ORIGINAL" | "REVISION";
    latestRevisionId: string | null;
    latestRevisionSequence: number;
    status: "DRAFT" | "FINALIZED";
    revisions: Array<{ id: string; sequence: number; priorAuthoritativeResult: number; revisedFinalResult: number; reason: string; evidenceReference: string; revisedAt: Date; revisedBy: { firstName: string; middleName: string | null; lastName: string } }>;
  } | null;
}

export function ShsTermResultDialog({
  enrollmentId,
  target,
  open,
  onOpenChange,
}: {
  enrollmentId: string;
  target: ShsTermResultTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [value, setValue] = useState(
    target.result?.authoritativeFinalResult?.toFixed(2) ?? target.result?.finalResult?.toFixed(2) ?? "",
  );
  const saveDraft = useSaveShsTermResultDraft(enrollmentId);
  const finalize = useFinalizeShsTermResult(enrollmentId);
  const revise = useReviseFinalizedShsTermResult(enrollmentId);
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const numericValue = value === "" ? null : Number(value);
  const invalid = numericValue !== null && (
    !Number.isFinite(numericValue) ||
    numericValue < 0 ||
    numericValue > 100 ||
    !/^\d{1,3}(\.\d{1,2})?$/.test(value)
  );
  const canFinalize =
    getPhilippineCalendarDate() >= target.academicTerm.endDate.toISOString().slice(0, 10);
  const pending = saveDraft.isPending || finalize.isPending || revise.isPending;
  const finalized = target.result?.status === "FINALIZED";
  const revisionPhrase = `REVISE ${target.subjectCode} ${target.academicTerm.name} RESULT`;
  const identity = {
    enrollmentId,
    studentSubjectEnrollmentId: target.studentSubjectEnrollmentId,
    academicTermId: target.academicTermId,
  };

  async function save() {
    const result = await saveDraft.mutateAsync({ ...identity, finalResult: numericValue });
    if (result.error) return toast.error(result.error);
    toast.success(result.success);
    onOpenChange(false);
  }

  async function finalizeResult() {
    const result = await finalize.mutateAsync(identity);
    if (result.error) return toast.error(result.error);
    toast.success(result.success);
    onOpenChange(false);
  }

  async function reviseResult() {
    if (!target.result) return;
    const result = await revise.mutateAsync({
      ...identity,
      shsTermResultId: target.result.id,
      expectedLatestRevisionId: target.result.latestRevisionId,
      expectedLatestRevisionSequence: target.result.latestRevisionSequence,
      expectedPriorAuthoritativeResult: target.result.authoritativeFinalResult ?? target.result.finalResult ?? 0,
      revisedFinalResult: numericValue ?? -1,
      reason,
      evidenceReference,
      typedConfirmation,
    });
    if (result.error) return toast.error(result.error);
    toast.success(result.success);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[95vw] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>SHS Term Result</DialogTitle>
          <DialogDescription>{finalized
            ? "The original finalized evidence remains unchanged. A revision changes only the authoritative result and does not correct subject participation."
            : "A finalized numeric result is immutable evidence only. It does not determine passing, completion, credits, or progression."}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p><span className="font-mono font-medium">{target.subjectCode}</span> | {target.subjectDescription}</p>
          <AcademicTermBadge
            position={target.academicTerm.position}
            name={target.academicTerm.name}
          />
        </div>

        {finalized && target.result ? (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3 text-sm">
            <p>Original FINALIZED value: <strong>{target.result.originalFinalResult?.toFixed(2)}</strong></p>
            <p>Current authoritative value: <strong>{target.result.authoritativeFinalResult?.toFixed(2)}</strong> ({target.result.authoritativeSource})</p>
            {target.result.revisions.map((revision) => <div key={revision.id} className="border-t pt-2"><p>Revision {revision.sequence}: {revision.priorAuthoritativeResult.toFixed(2)} to {revision.revisedFinalResult.toFixed(2)}</p><p className="text-muted-foreground">{revision.reason} | {revision.evidenceReference}</p></div>)}
          </div>
        ) : null}

        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="shs-term-final-result">Final result</FieldLabel>
          <Input
            id="shs-term-final-result"
            type="number"
            min="0"
            max="100"
            step="0.01"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={pending}
            aria-invalid={invalid || undefined}
            placeholder="0.00-100.00"
          />
          <FieldDescription>{finalized ? "Proposed revised value. The original finalized value will remain immutable." : "A draft may be blank. Finalization requires a value from 0.00 to 100.00 with at most two decimal places."}</FieldDescription>
        </Field>

        {finalized ? <>
          <Field><FieldLabel htmlFor="shs-result-revision-reason">Revision reason</FieldLabel><Input id="shs-result-revision-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} disabled={pending} /></Field>
          <Field><FieldLabel htmlFor="shs-result-revision-evidence">Evidence/reference</FieldLabel><Input id="shs-result-revision-evidence" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} maxLength={500} disabled={pending} /></Field>
          <Field><FieldLabel htmlFor="shs-result-revision-confirmation">Type {revisionPhrase}</FieldLabel><Input id="shs-result-revision-confirmation" value={typedConfirmation} onChange={(event) => setTypedConfirmation(event.target.value)} disabled={pending} /></Field>
        </> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          {!finalized && <Button variant="outline" onClick={() => void save()} disabled={invalid || pending}>
            {saveDraft.isPending ? "Saving..." : "Save Draft"}
          </Button>}
          {target.result?.status === "DRAFT" && (
            <Button
              onClick={() => void finalizeResult()}
              disabled={!canFinalize || target.result.finalResult === null || pending}
              title={!canFinalize ? "Finalization is available on or after the Academic Term end date." : undefined}
            >
              {finalize.isPending ? "Finalizing..." : "Finalize existing draft"}
            </Button>
          )}
          {finalized && <Button onClick={() => void reviseResult()} disabled={invalid || numericValue === null || !reason.trim() || !evidenceReference.trim() || typedConfirmation !== revisionPhrase || pending}>{revise.isPending ? "Revising..." : "Record Immutable Revision"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
