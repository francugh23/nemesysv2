"use client";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import type { SectionListItem } from "@/schemas";

import { EditSectionForm } from "./edit-section-form";

interface EditSectionDialogProps {
  section: SectionListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSectionDialog({
  section,
  open,
  onOpenChange,
}: EditSectionDialogProps) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Edit Section">
      <EditSectionForm
        section={section}
        onSuccess={() => onOpenChange(false)}
      />
    </FormDialog>
  );
}
