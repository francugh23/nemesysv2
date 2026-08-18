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
    finalResult: number | null;
    status: "DRAFT" | "FINALIZED";
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
    target.result?.finalResult?.toFixed(2) ?? "",
  );
  const saveDraft = useSaveShsTermResultDraft(enrollmentId);
  const finalize = useFinalizeShsTermResult(enrollmentId);
  const numericValue = value === "" ? null : Number(value);
  const invalid = numericValue !== null && (
    !Number.isFinite(numericValue) ||
    numericValue < 0 ||
    numericValue > 100 ||
    !/^\d{1,3}(\.\d{1,2})?$/.test(value)
  );
  const canFinalize =
    getPhilippineCalendarDate() >= target.academicTerm.endDate.toISOString().slice(0, 10);
  const pending = saveDraft.isPending || finalize.isPending;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>SHS Term Result</DialogTitle>
          <DialogDescription>
            A finalized numeric result is immutable evidence only. It does not
            determine passing, completion, credits, or progression.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p><span className="font-mono font-medium">{target.subjectCode}</span> | {target.subjectDescription}</p>
          <AcademicTermBadge
            position={target.academicTerm.position}
            name={target.academicTerm.name}
          />
        </div>

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
          <FieldDescription>
            A draft may be blank. Finalization requires a value from 0.00 to 100.00 with at most two decimal places.
          </FieldDescription>
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button variant="outline" onClick={() => void save()} disabled={invalid || pending}>
            {saveDraft.isPending ? "Saving..." : "Save Draft"}
          </Button>
          {target.result?.status === "DRAFT" && (
            <Button
              onClick={() => void finalizeResult()}
              disabled={!canFinalize || target.result.finalResult === null || pending}
              title={!canFinalize ? "Finalization is available on or after the Academic Term end date." : undefined}
            >
              {finalize.isPending ? "Finalizing..." : "Finalize existing draft"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
