"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useCorrectShsStudentParticipation, useShsStudentParticipationCorrectionContext, useShsStudentParticipationCorrectionPreview } from "@/hooks/enrollment.hook";
import type { EnrollmentListItem } from "@/schemas";

export function CorrectShsStudentParticipationDialog({ enrollment, open, onOpenChange }: { enrollment: EnrollmentListItem; open: boolean; onOpenChange: (open: boolean) => void }) {
  const contextQuery = useShsStudentParticipationCorrectionContext(enrollment.id, open);
  const [sourceId, setSourceId] = useState("");
  const [termId, setTermId] = useState("");
  const [replacementId, setReplacementId] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [typedConfirmation, setTypedConfirmation] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const previewQuery = useShsStudentParticipationCorrectionPreview(enrollment.id, sourceId, termId, open);
  const preview = previewQuery.data;
  const mutation = useCorrectShsStudentParticipation();
  const selectedSource = contextQuery.data?.sources.find(({ id }) => id === sourceId);
  const candidate = preview?.candidates.find(({ id }) => id === replacementId);
  const invalid = !candidate || !preview?.eligible || !reason.trim() || !evidenceReference.trim() || reason.length > 500 || evidenceReference.length > 500 || !confirmed || (preview.requiresTypedConfirmation && typedConfirmation !== preview.typedConfirmationPhrase);

  async function submit() {
    if (!candidate || !preview) return;
    const result = await mutation.mutateAsync({ id: enrollment.id, values: { sourceStudentSubjectEnrollmentId: sourceId, sourceAcademicTermId: termId, replacementSubjectOfferingId: candidate.id, reason: reason.trim(), evidenceReference: evidenceReference.trim(), typedConfirmation, confirmed: true } });
    if (result.error) {
      toast.error(result.error);
      await previewQuery.refetch();
      return;
    }
    toast.success(result.success);
    onOpenChange(false);
  }

  return <Dialog open={open} onOpenChange={(value) => !mutation.isPending && onOpenChange(value)}>
    <DialogContent className="flex max-h-[92dvh] w-[96vw] max-w-4xl! flex-col overflow-hidden p-0">
      <DialogHeader className="shrink-0 border-b px-4 pt-5 pb-4 sm:px-6 sm:pt-6"><DialogTitle>Correct Subject Participation</DialogTitle><DialogDescription>Replace one active SHS participation record only. The source and its exact Term evidence remain permanent history.</DialogDescription></DialogHeader>
      <ScrollArea className="min-h-0 flex-1"><div className="space-y-5 px-4 py-5 sm:px-6">
        {contextQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading SHS correction context...</p> : null}
        {contextQuery.isError ? <p className="text-sm text-destructive">Unable to load SHS correction context.</p> : null}
        {contextQuery.data ? <>
          <Field><FieldLabel>Source Participation *</FieldLabel><SearchableSelect value={sourceId} onValueChange={(value) => { setSourceId(value); setTermId(""); setReplacementId(""); setTypedConfirmation(""); setConfirmed(false); }} options={contextQuery.data.sources.map((source) => ({ value: source.id, label: `${source.subjectCode} - ${source.subjectDescription} (${source.kind})` }))} placeholder="Select active SHS participation" disabled={mutation.isPending} /></Field>
          {selectedSource ? <Field><FieldLabel>Affected Academic Term *</FieldLabel><SearchableSelect value={termId} onValueChange={(value) => { setTermId(value); setReplacementId(""); setTypedConfirmation(""); setConfirmed(false); }} options={selectedSource.terms.map((term) => ({ value: term.id, label: `${term.name}${term.resultStatus ? ` - ${term.resultStatus} result` : ""}` }))} placeholder="Select the exact affected Term" disabled={mutation.isPending} /><FieldDescription>Core replacement covers this Term and its remaining source Terms. Electives replace only this exact Term.</FieldDescription></Field> : null}
          {previewQuery.isLoading ? <p className="text-sm text-muted-foreground">Reviewing authoritative correction scope...</p> : null}
          {preview ? <>
            {preview.blockers.length ? <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive" role="alert"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><p className="font-medium">This participation correction cannot be recorded.</p>{preview.blockers.map((blocker) => <p key={blocker} className="mt-1">{blocker}</p>)}</div></div> : null}
            <div className="rounded-lg border bg-muted/20 p-4 text-sm"><p className="font-medium">Authoritative scope</p><p className="mt-1 text-muted-foreground">{preview.source.kind} | selected {preview.source.selectedTerm.name} | replacement Terms: {preview.source.plannedTerms.map(({ name }) => name).join(", ")}</p><p className="mt-1 text-muted-foreground">Results: {preview.source.resultStates.map(({ name, status }) => `${name}: ${status ?? "none"}`).join("; ")}</p>{preview.policy ? <p className="mt-1 text-muted-foreground">Elective policy: {preview.policy.minimumElectives}-{preview.policy.maximumElectives}; active count: {preview.policy.activeElectiveCount}.</p> : null}</div>
            <Field><FieldLabel>Replacement Offering *</FieldLabel><SearchableSelect value={replacementId} onValueChange={(value) => { setReplacementId(value); setTypedConfirmation(""); setConfirmed(false); }} options={preview.candidates.map((item) => ({ value: item.id, label: `${item.subjectCode} - ${item.subjectDescription}${item.clusterName ? ` (${item.clusterName})` : ""}` }))} placeholder={preview.candidates.length ? "Select a valid replacement Offering" : "No valid replacement Offerings"} disabled={!preview.eligible || !preview.candidates.length || mutation.isPending} /><FieldDescription>Only server-validated, classification-compatible Offerings covering the exact safe scope are listed.</FieldDescription></Field>
          </> : null}
          <Field><FieldLabel htmlFor="shs-correction-reason">Correction Reason *</FieldLabel><Textarea id="shs-correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} disabled={mutation.isPending} /></Field>
          <Field><FieldLabel htmlFor="shs-correction-evidence">Evidence / Reference *</FieldLabel><Textarea id="shs-correction-evidence" value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} maxLength={500} rows={2} disabled={mutation.isPending} /></Field>
          {preview?.requiresTypedConfirmation ? <Field><FieldLabel htmlFor="shs-correction-confirmation">Because this Academic Term has started, type <span className="font-mono">{preview.typedConfirmationPhrase}</span> *</FieldLabel><Input id="shs-correction-confirmation" value={typedConfirmation} onChange={(event) => setTypedConfirmation(event.target.value)} autoComplete="off" disabled={mutation.isPending} /></Field> : null}
          <label className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><Checkbox checked={confirmed} onCheckedChange={(checked) => setConfirmed(checked === true)} disabled={mutation.isPending} /><span>I confirm this permanent, audited SHS participation correction. Source participation, exact Terms, and results will not be moved, rewritten, or deleted.</span></label>
        </> : null}
      </div></ScrollArea>
      <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none px-4 sm:px-6"><Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>Cancel</Button><Button onClick={() => void submit()} disabled={mutation.isPending || invalid}>{mutation.isPending ? "Correcting..." : "Record Subject Correction"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
