"use client";

import type { SectionListItem } from "@/schemas";

import { ArchiveSectionDialog } from "./archive-section-dialog";
import { EditSectionDialog } from "./edit-section-dialog";
import { SectionViewDialog } from "./section-view-dialog";

export type SectionDialogType = "view" | "edit" | "archive" | null;

interface SectionDialogManagerProps {
  section: SectionListItem | null;
  dialog: SectionDialogType;
  instanceId: number;
  onClose: (instanceId: number) => void;
}

export function SectionDialogManager({
  section,
  dialog,
  instanceId,
  onClose,
}: SectionDialogManagerProps) {
  if (!section) {
    return null;
  }

  return (
    <>
      <SectionViewDialog
        section={section}
        open={dialog === "view"}
        onOpenChange={(open) => !open && onClose(instanceId)}
      />
      <EditSectionDialog
        section={section}
        open={dialog === "edit"}
        onOpenChange={(open) => !open && onClose(instanceId)}
      />
      <ArchiveSectionDialog
        section={section}
        open={dialog === "archive"}
        onOpenChange={(open) => !open && onClose(instanceId)}
      />
    </>
  );
}
