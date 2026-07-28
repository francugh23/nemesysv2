"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { archiveSubjectAction } from "@/actions/subject.action";
import { ConfirmDeleteDialog } from "@/components/common/dialogs/confirm-delete-dialog";
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
  const [isArchiving, setIsArchiving] = useState(false);
  const queryClient = useQueryClient();
  const isConfirmed = confirmation === subject.code;

  async function handleArchive() {
    if (!isConfirmed) return;

    setIsArchiving(true);
    const result = await archiveSubjectAction(subject.id);

    if (result.error) {
      toast.error(result.error);
      setIsArchiving(false);
      return;
    }

    toast.success(result.success);
    await queryClient.invalidateQueries({
      queryKey: ["subjects"],
    });
    setIsArchiving(false);
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
      isDeleting={isArchiving}
      actionLabel="Archive"
      processingLabel="Archiving..."
      onConfirm={handleArchive}
    />
  );
}
