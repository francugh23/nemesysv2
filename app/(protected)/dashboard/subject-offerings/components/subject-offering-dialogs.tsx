"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CirclePlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { ConfirmDeleteDialog } from "@/components/common/dialogs/confirm-delete-dialog";
import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useArchiveSubjectOffering,
  useCreateSubjectOffering,
  useUpdateSubjectOffering,
  usePromoteShsSubjectOffering,
} from "@/hooks/subject-offering.hook";
import {
  CreateSubjectOfferingSchema,
  UpdateSubjectOfferingSchema,
} from "@/schemas";
import { useState } from "react";

import { SubjectOfferingForm } from "./subject-offering-form";
import type { SubjectOfferingListItem } from "./subject-offering-types";

function OfferingForm({
  offering,
  onSuccess,
}: {
  offering?: SubjectOfferingListItem;
  onSuccess: () => void;
}) {
  const createOffering = useCreateSubjectOffering();
  const updateOffering = useUpdateSubjectOffering();
  const form = useForm<z.infer<typeof CreateSubjectOfferingSchema>>({
    resolver: zodResolver(
      offering ? UpdateSubjectOfferingSchema : CreateSubjectOfferingSchema,
    ),
    defaultValues: offering
      ? {
          subjectId: offering.subjectId,
          academicYearId: offering.academicYearId,
           gradeLevel: offering.gradeLevel as "7" | "8" | "9" | "10" | "11" | "12",
           academicTermIds: offering.terms.map((term) => term.academicTermId),
           shsContext: offering.shsContext
             ? {
                 classification: offering.shsContext.classification,
                  curriculumStatus: "PROVISIONAL_DEPED",
                 clusterId: offering.shsContext.cluster?.id,
                 sourceReference: offering.shsContext.sourceReference ?? undefined,
               }
             : undefined,
         }
      : { subjectId: "", academicYearId: "", gradeLevel: undefined, academicTermIds: [] },
  });
  const mutation = offering ? updateOffering : createOffering;

  async function onSubmit(values: z.infer<typeof CreateSubjectOfferingSchema>) {
    const result = offering
      ? await updateOffering.mutateAsync({ id: offering.id, values })
      : await createOffering.mutateAsync(values);

    if (!("success" in result)) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    onSuccess();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <SubjectOfferingForm form={form} />
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending
          ? offering
            ? "Saving..."
            : "Creating..."
          : offering
            ? "Update Offering"
            : "Create Offering"}
      </Button>
    </form>
  );
}

export function CreateSubjectOfferingDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CirclePlus />
        Add Offering
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Create Subject Offering">
        <OfferingForm onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}

export function EditSubjectOfferingDialog({
  offering,
  open,
  onOpenChange,
}: {
  offering: SubjectOfferingListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Edit Subject Offering">
      <OfferingForm offering={offering} onSuccess={() => onOpenChange(false)} />
    </FormDialog>
  );
}

export function ArchiveSubjectOfferingDialog({
  offering,
  open,
  onOpenChange,
}: {
  offering: SubjectOfferingListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const archiveOffering = useArchiveSubjectOffering();
  const isConfirmed = confirmation === offering.subjectCode;

  async function archive() {
    if (!isConfirmed) return;

    const result = await archiveOffering.mutateAsync(offering.id);
    if (!("success" in result)) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    onOpenChange(false);
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) setConfirmation("");
        onOpenChange(value);
      }}
      title="Archive Subject Offering"
      description="This hides the offering from active use. Historical records remain preserved."
      confirmLabel="To confirm, type the Subject code:"
      confirmValue={offering.subjectCode}
      itemLabel="Subject Offering"
      itemName={`${offering.subjectCode} - ${offering.academicYear.label}`}
      inputValue={confirmation}
      onInputChange={setConfirmation}
      canConfirm={isConfirmed}
      isDeleting={archiveOffering.isPending}
      actionLabel="Archive"
      processingLabel="Archiving..."
      onConfirm={archive}
    />
  );
}

export function ApproveShsSubjectOfferingDialog({ offering, open, onOpenChange }: { offering: SubjectOfferingListItem; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [approvalReference, setApprovalReference] = useState("");
  const approveOffering = usePromoteShsSubjectOffering();
  async function approve() { const result = await approveOffering.mutateAsync({ subjectOfferingId: offering.id, approvalReference }); if ("error" in result) { toast.error(result.error); return; } toast.success(result.success); setApprovalReference(""); onOpenChange(false); }
  return <FormDialog open={open} onOpenChange={onOpenChange} title="Approve SSHS Subject Offering"><div className="space-y-4"><p className="text-sm text-muted-foreground">Approve {offering.subjectCode} for school use. This does not select it for any student.</p><Input value={approvalReference} onChange={(event) => setApprovalReference(event.target.value)} placeholder="School approval reference" /><Button onClick={() => void approve()} disabled={!approvalReference.trim() || approveOffering.isPending}>{approveOffering.isPending ? "Approving..." : "Approve offering"}</Button></div></FormDialog>;
}
