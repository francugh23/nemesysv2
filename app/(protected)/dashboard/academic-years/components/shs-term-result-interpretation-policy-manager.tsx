"use client";

import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  usePublishShsTermResultInterpretationPolicy,
  useSaveShsTermResultInterpretationPolicyDraft,
  useShsTermResultInterpretationPolicy,
} from "@/hooks/shs-term-result-interpretation-policy.hook";
import { formatDateTime } from "@/lib/format";

export function ShsTermResultInterpretationPolicyManager({
  academicYearId,
  open,
  isActive,
}: {
  academicYearId: string;
  open: boolean;
  isActive: boolean;
}) {
  const { data: policy, isLoading, isError } =
    useShsTermResultInterpretationPolicy(academicYearId, open);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-semibold">SHS Term Result Interpretation Policy</h3>
        <p className="text-sm text-muted-foreground">
          Adopt the school-approved 75.00 passing threshold for all Grade 11 and 12 SHS Term Results in this Academic Year.
        </p>
        <p className="text-xs text-muted-foreground">
          Term interpretation does not establish subject completion, credits, promotion, or graduation.
        </p>
      </div>
      <div className="rounded-lg border p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading interpretation policy...</p>
        ) : isError ? (
          <p className="text-sm text-destructive">Unable to load the interpretation policy.</p>
        ) : (
          <PolicyEditor
            key={policy?.updatedAt.toString() ?? "new"}
            academicYearId={academicYearId}
            isActive={isActive}
            policy={policy}
          />
        )}
      </div>
    </section>
  );
}

type Policy = NonNullable<
  ReturnType<typeof useShsTermResultInterpretationPolicy>["data"]
>;

function PolicyEditor({
  academicYearId,
  isActive,
  policy,
}: {
  academicYearId: string;
  isActive: boolean;
  policy: Policy | null | undefined;
}) {
  const [sourceReference, setSourceReference] = useState(policy?.sourceReference ?? "");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const saveDraft = useSaveShsTermResultInterpretationPolicyDraft();
  const publish = usePublishShsTermResultInterpretationPolicy();
  const isPublished = policy?.status === "PUBLISHED";
  const isPending = saveDraft.isPending || publish.isPending;
  const trimmedReference = sourceReference.trim();
  const isUnchanged = policy?.sourceReference === trimmedReference;

  async function save() {
    try {
      const result = await saveDraft.mutateAsync({
        academicYearId,
        passingThreshold: 75,
        sourceReference: trimmedReference,
      });
      if (result.error) return toast.error(result.error);
      toast.success(result.success);
    } catch {
      toast.error("Unable to save the interpretation policy draft. Try again.");
    }
  }

  async function publishPolicy() {
    if (!policy) return;
    try {
      const result = await publish.mutateAsync({ academicYearId, policyId: policy.id });
      if (result.error) return toast.error(result.error);
      toast.success(result.success);
      setConfirmPublish(false);
    } catch {
      toast.error("Unable to publish the interpretation policy. Try again.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">Academic Year Policy</span>
          <Badge variant={isPublished ? "default" : "secondary"}>
            {policy?.status ?? "NOT CONFIGURED"}
          </Badge>
        </div>
        {isPublished && <LockKeyhole className="size-4 text-muted-foreground" />}
      </div>

      {!isActive && !isPublished && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Policy drafting and publication are available only while the Academic Year is active.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
        <Field>
          <FieldLabel htmlFor="shs-passing-threshold">Passing Threshold</FieldLabel>
          <Input id="shs-passing-threshold" value="75.00" readOnly disabled />
          <FieldDescription>No rounding or transmutation is applied.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="shs-policy-source">School-Approved Reference</FieldLabel>
          <Textarea
            id="shs-policy-source"
            value={sourceReference}
            onChange={(event) => setSourceReference(event.target.value)}
            disabled={!isActive || isPublished || isPending}
            placeholder="Document title, approval reference, or other approved basis"
            rows={3}
          />
        </Field>
      </div>

      {isPublished ? (
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            Published {formatDateTime(policy.publishedAt)} by {policy.publishedBy?.firstName} {policy.publishedBy?.lastName}.
          </p>
          <p>
            This policy is immutable. It interprets finalized results without modifying their evidence.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!isActive || isPending || !trimmedReference || Boolean(policy && isUnchanged)}
            onClick={() => void save()}
          >
            {saveDraft.isPending ? "Saving..." : policy ? "Save Draft" : "Create Draft"}
          </Button>
          {policy && (
            <Button
              type="button"
              disabled={!isActive || isPending || !isUnchanged}
              onClick={() => setConfirmPublish(true)}
            >
              Publish Policy
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={confirmPublish} onOpenChange={setConfirmPublish}>
        <AlertDialogContent className="w-[95vw] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Publish interpretation policy?</AlertDialogTitle>
            <AlertDialogDescription>
              Publication is permanent. Every finalized Grade 11 and 12 SHS Term Result in this Academic Year will be interpreted as PASSED at 75.00 or above and FAILED below 75.00, without rounding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publish.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={publish.isPending}
              onClick={(event) => {
                event.preventDefault();
                void publishPolicy();
              }}
            >
              {publish.isPending ? "Publishing..." : "Publish Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
