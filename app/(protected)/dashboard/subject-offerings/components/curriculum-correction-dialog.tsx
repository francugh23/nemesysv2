"use client";

import { useState } from "react";
import { GitCompareArrows, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AcademicTermBadge } from "@/components/common/badges";
import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCorrectSubjectOffering,
  useCurriculumCorrectionContext,
  useCurriculumCorrectionDetail,
} from "@/hooks/subject-offering.hook";
import {
  getShsCurriculumStatusLabel,
  getShsSubjectClassificationLabel,
} from "@/lib/shs-presentation";

import type { SubjectOfferingListItem } from "./subject-offering-types";

type Classification = "CORE" | "ACADEMIC_ELECTIVE" | "TECHPRO_ELECTIVE";

export function CurriculumCorrectionDialog({
  offering,
  open,
  onOpenChange,
}: {
  offering: SubjectOfferingListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const contextQuery = useCurriculumCorrectionContext(offering.id, open);
  if (contextQuery.data) {
    return <CorrectionForm key={`${offering.id}-${contextQuery.data.operationalDate}`} offering={offering} data={contextQuery.data} open={open} onOpenChange={onOpenChange} />;
  }
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Correct / Replace Curriculum Offering">
      {contextQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading correction context...</p>
      ) : (
        <div className="space-y-3 py-6 text-center">
          <p className="text-sm text-destructive">Unable to load controlled correction context.</p>
          <Button variant="outline" onClick={() => void contextQuery.refetch()}>Try again</Button>
        </div>
      )}
    </FormDialog>
  );
}

function CorrectionForm({
  offering,
  data,
  open,
  onOpenChange,
}: {
  offering: SubjectOfferingListItem;
  data: NonNullable<ReturnType<typeof useCurriculumCorrectionContext>["data"]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const correction = useCorrectSubjectOffering();
  const effectiveTerm = data.plan.effectiveTerm;
  const successorTerms = data.plan.successorTerms;
  const isJhs = ["7", "8", "9", "10"].includes(offering.gradeLevel);
  const isShs = !isJhs;
  const [subjectId, setSubjectId] = useState(data.source.subjectId);
  const [classification, setClassification] = useState<Classification>(data.source.shsContext?.classification ?? "CORE");
  const [clusterId, setClusterId] = useState(data.source.shsContext?.clusterId ?? "");
  const [sourceReference, setSourceReference] = useState("");
  const [approvalReference, setApprovalReference] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const availableClusters = data.shsClusters.filter((cluster) =>
    classification === "ACADEMIC_ELECTIVE" ? cluster.track === "ACADEMIC" : cluster.track === "TECHPRO");
  const electivePolicyCompatible = classification === "CORE" ||
    successorTerms.every((term) => data.electivePolicies.some((policy) => policy.academicTermId === term.id));
  const canSubmit = Boolean(
    !data.eligibilityReason &&
    subjectId &&
    effectiveTerm &&
    successorTerms.length &&
    reason.trim() &&
    evidenceReference.trim() &&
    confirmation === offering.subjectCode &&
    (!isShs || (sourceReference.trim() && approvalReference.trim() && (classification === "CORE" || clusterId) && electivePolicyCompatible)),
  );

  async function submit() {
    if (!canSubmit) return;
    const result = await correction.mutateAsync({
      sourceOfferingId: offering.id,
      effectiveAcademicTermId: effectiveTerm!.id,
      reason,
      evidenceReference,
      confirmation,
      replacement: {
        subjectId,
        gradeLevel: offering.gradeLevel,
        academicTermIds: successorTerms.map(({ id }) => id),
        shsContext: isShs ? {
          classification,
          clusterId: classification === "CORE" ? undefined : clusterId,
          sourceReference,
          approvalReference,
        } : undefined,
      },
    });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success(result.success);
    onOpenChange(false);
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(value) => !correction.isPending && onOpenChange(value)}
      title="Correct / Replace Curriculum Offering"
    >
        <div className="space-y-6">
          <div className="grid gap-3 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact label="Locked predecessor" value={`${data.source.subjectCode} - ${data.source.subjectDescription}`} />
            <Fact label="Academic Year" value={data.source.academicYear.label} />
            <Fact label="Student participation" value={String(data.impact.participationCount)} />
            <Fact label="Recorded results" value={String(data.impact.resultCount)} />
            <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap gap-2">
              {data.source.academicYear.curriculumFinalization && <Badge>Finalized Curriculum</Badge>}
              {data.impact.participationCount > 0 && <Badge variant="outline">Locked by Student Participation</Badge>}
            </div>
          </div>

          {data.eligibilityReason && (
            <div className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <p>{data.eligibilityReason}</p>
            </div>
          )}

          <div className="space-y-4 rounded-xl border p-4">
            <div>
              <h3 className="font-semibold">Prospective successor</h3>
              <p className="text-sm text-muted-foreground">The Academic Year and grade remain fixed. The successor receives a new Offering identity.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Replacement Subject</FieldLabel>
                <SearchableSelect
                  value={subjectId}
                  onValueChange={setSubjectId}
                  options={data.subjects.map((subject) => ({ value: subject.id, label: `${subject.code} - ${subject.description}` }))}
                  placeholder="Select replacement Subject"
                />
              </Field>
              <Fact label="Immediately next effective Term" value={effectiveTerm?.name ?? "Unavailable"} />
            </div>

            <Field>
              <FieldLabel>Derived successor Terms</FieldLabel>
              <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                {successorTerms.map((term) => <AcademicTermBadge key={term.id} position={term.position} name={term.name} />)}
                {!successorTerms.length && <span className="text-sm text-muted-foreground">No eligible remaining Terms</span>}
              </div>
            </Field>

            {isShs && (
              <div className="grid gap-4 rounded-lg border p-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <p className="font-medium">Atomic school approval</p>
                  <p className="text-sm text-muted-foreground">The successor is created {getShsCurriculumStatusLabel("SCHOOL_APPROVED")} with new provenance and approval evidence.</p>
                </div>
                <Field>
                  <FieldLabel>Classification</FieldLabel>
                  <Select value={classification} onValueChange={(value) => {
                    setClassification(value as Classification);
                    setClusterId("");
                  }}>
                    <SelectTrigger>
                      <SelectValue>
                        {getShsSubjectClassificationLabel(classification)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CORE">{getShsSubjectClassificationLabel("CORE")}</SelectItem>
                      <SelectItem value="ACADEMIC_ELECTIVE">{getShsSubjectClassificationLabel("ACADEMIC_ELECTIVE")}</SelectItem>
                      <SelectItem value="TECHPRO_ELECTIVE">{getShsSubjectClassificationLabel("TECHPRO_ELECTIVE")}</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {classification !== "CORE" && (
                  <Field>
                    <FieldLabel>School-Facing Cluster</FieldLabel>
                    <SearchableSelect
                      value={clusterId}
                      onValueChange={setClusterId}
                      options={availableClusters.map((cluster) => ({ value: cluster.id, label: `${cluster.code} - ${cluster.name}` }))}
                      placeholder="Select compatible cluster"
                    />
                  </Field>
                )}
                <div className="md:col-span-2 rounded-md border bg-muted/20 p-3 text-sm">
                  {classification === "CORE" ? (
                    <span className="text-muted-foreground">Elective policy: Not applicable</span>
                  ) : electivePolicyCompatible ? (
                    <span>Compatible elective policies exist for every successor Term.</span>
                  ) : (
                    <span className="text-destructive">An existing Grade {offering.gradeLevel} elective policy is required for every successor Term.</span>
                  )}
                </div>
                <Field>
                  <FieldLabel>Source / Provenance Reference</FieldLabel>
                  <Input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} maxLength={500} />
                </Field>
                <Field>
                  <FieldLabel>School Approval Reference</FieldLabel>
                  <Input value={approvalReference} onChange={(event) => setApprovalReference(event.target.value)} maxLength={500} />
                </Field>
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <div>
              <h3 className="font-semibold">Lineage preview</h3>
              <p className="text-sm text-muted-foreground">Effective {effectiveTerm?.name ?? "Term unavailable"}. The predecessor is archived and the successor becomes the active prospective identity.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <LineageCard
                role="Historical predecessor"
                subject={`${data.source.subjectCode} - ${data.source.subjectDescription}`}
                terms={data.source.terms.map(({ academicTerm }) => academicTerm)}
                context={formatShsContext(data.source.shsContext)}
              />
              <LineageCard
                role="Prospective successor"
                subject={data.subjects.find((subject) => subject.id === subjectId) ? `${data.subjects.find((subject) => subject.id === subjectId)!.code} - ${data.subjects.find((subject) => subject.id === subjectId)!.description}` : "Select a Subject"}
                terms={successorTerms}
                context={isShs ? formatClassification(classification, availableClusters.find((cluster) => cluster.id === clusterId)?.name) : "JHS"}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>Correction reason</FieldLabel>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Explain the configuration error and prospective correction." />
            </Field>
            <Field>
              <FieldLabel>Evidence / Reference</FieldLabel>
              <Textarea value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} maxLength={500} placeholder="Document, memorandum, or approval reference." />
            </Field>
          </div>

          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
            <p className="font-medium">Historical records will not be rewritten</p>
            <p className="mt-1 text-sm text-muted-foreground">Existing students remain on the historical Offering. The replacement applies prospectively only. Student-specific placement or enrollment errors are not corrected here.</p>
          </div>

          <Field>
            <FieldLabel>To confirm, type the predecessor Subject code: <span className="font-mono">{offering.subjectCode}</span></FieldLabel>
            <Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" />
          </Field>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={correction.isPending}>Cancel</Button>
            <Button variant="destructive" onClick={() => void submit()} disabled={!canSubmit || correction.isPending}>
              <GitCompareArrows /> {correction.isPending ? "Replacing..." : "Archive and create replacement"}
            </Button>
          </div>
        </div>
    </FormDialog>
  );
}

export function CurriculumCorrectionDetailDialog({
  offering,
  open,
  onOpenChange,
}: {
  offering: SubjectOfferingListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detailQuery = useCurriculumCorrectionDetail(offering.id, open);
  const correction = detailQuery.data;
  const actor = correction ? [correction.correctedBy.firstName, correction.correctedBy.middleName, correction.correctedBy.lastName].filter(Boolean).join(" ") : "";
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Controlled Correction Details" maxWidth="max-w-2xl!">
      {detailQuery.isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading correction details...</p> : correction ? (
        <div className="space-y-5">
          <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
            <Fact label="Replaced predecessor" value={`${correction.sourceOffering.subjectCode} - ${correction.sourceOffering.subjectDescription}`} />
            <Fact label="Active replacement" value={`${correction.replacementOffering.subjectCode} - ${correction.replacementOffering.subjectDescription}`} />
            <Fact label="Effective Term" value={correction.effectiveAcademicTerm.name} />
            <Fact label="Corrected by" value={actor} />
          </div>
          <div><p className="text-sm font-medium">Reason</p><p className="text-sm text-muted-foreground">{correction.reason}</p></div>
          <div><p className="text-sm font-medium">Evidence / Reference</p><p className="text-sm text-muted-foreground">{correction.evidenceReference}</p></div>
          <div className="flex flex-wrap gap-2"><Badge variant="secondary">Predecessor: Replaced</Badge><Badge>Successor: Replacement</Badge><Badge variant="outline">{correction.sourceParticipationCount} historical participation record{correction.sourceParticipationCount === 1 ? "" : "s"}</Badge></div>
          <p className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">Existing students and historical results remain attached to the original Offering. The replacement applies prospectively only.</p>
        </div>
      ) : <p className="py-8 text-center text-sm text-destructive">Unable to load correction details.</p>}
    </FormDialog>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function LineageCard({ role, subject, terms, context }: { role: string; subject: string; terms: Array<{ id?: string; name: string; position: number }>; context: string }) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{role}</p>
      <p className="text-sm font-medium">{subject}</p>
      <div className="flex flex-wrap gap-1">{terms.map((term) => <AcademicTermBadge key={term.id ?? `${term.position}-${term.name}`} position={term.position} name={term.name} />)}</div>
      <p className="text-xs text-muted-foreground">{context}</p>
    </div>
  );
}

function formatClassification(classification: Classification, clusterName?: string) {
  const label = getShsSubjectClassificationLabel(classification);
  return clusterName ? `${label} - ${clusterName}` : label;
}

function formatShsContext(context: { classification: Classification; cluster?: { name: string } | null } | null) {
  return context ? formatClassification(context.classification, context.cluster?.name) : "JHS";
}
