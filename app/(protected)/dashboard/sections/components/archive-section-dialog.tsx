"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/common/dialogs/confirm-delete-dialog";
import { useArchiveSection } from "@/hooks/section.hook";
import type { SectionListItem } from "@/schemas";

interface ArchiveSectionDialogProps {
  section: SectionListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ArchiveSectionDialog({
  section,
  open,
  onOpenChange,
}: ArchiveSectionDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const archiveSection = useArchiveSection();
  const isConfirmed = confirmation === section.sectionName;
  const sectionIdentity = `Grade ${section.gradeLevel}${section.trackStrand ? ` - ${section.trackStrand}` : ""} - ${section.sectionName}`;

  async function handleArchive() {
    if (!isConfirmed) return;

    const result = await archiveSection.mutateAsync(section.id);

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
      title="Archive Section"
      description="This hides the Section from active records and selection options. Historical relationships remain preserved."
      confirmLabel="To confirm, type the Section name:"
      confirmValue={section.sectionName}
      itemLabel="Section"
      itemName={sectionIdentity}
      inputValue={confirmation}
      onInputChange={setConfirmation}
      canConfirm={isConfirmed}
      isDeleting={archiveSection.isPending}
      actionLabel="Archive"
      processingLabel="Archiving..."
      onConfirm={handleArchive}
    />
  );
}
