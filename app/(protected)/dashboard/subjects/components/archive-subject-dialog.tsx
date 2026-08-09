"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/common/dialogs/confirm-delete-dialog";
import { useArchiveSubject } from "@/hooks/subject.hook";
import type { SubjectListItem } from "@/schemas";

interface ArchiveSubjectDialogProps {
  subject: SubjectListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchiveSubjectDialog({
  subject,
  open,
  onOpenChange,
}: ArchiveSubjectDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const archiveSubject = useArchiveSubject();
  const isConfirmed = confirmation === subject.code;

  async function handleArchive() {
    if (!isConfirmed) return;

    const result = await archiveSubject.mutateAsync(subject.id);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    setConfirmation("");
    onOpenChange(false);
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setConfirmation("");
        }

        onOpenChange(value);
      }}
      title="Archive Subject"
      description="This hides the Subject from active records. Historical Grades remain preserved."
      confirmLabel="To confirm, type the Subject code:"
      confirmValue={subject.code}
      itemLabel="Subject"
      itemName={`${subject.code} - ${subject.description}`}
      inputValue={confirmation}
      onInputChange={setConfirmation}
      canConfirm={isConfirmed}
       isDeleting={archiveSubject.isPending}
      actionLabel="Archive"
      processingLabel="Archiving..."
      onConfirm={handleArchive}
    />
  );
}
