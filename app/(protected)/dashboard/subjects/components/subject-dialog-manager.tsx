"use client";

import type { SubjectListItem } from "@/schemas";

import { ArchiveSubjectDialog } from "./archive-subject-dialog";
import { EditSubjectDialog } from "./edit-subject-dialog";
import { SubjectViewDialog } from "./subject-view-dialog";

export type SubjectDialogType = "view" | "edit" | "archive" | null;

interface SubjectDialogManagerProps {
  subject: SubjectListItem | null;
  dialog: SubjectDialogType;
  onClose: () => void;
}

export function SubjectDialogManager({
  subject,
  dialog,
  onClose,
}: SubjectDialogManagerProps) {
  if (!subject) {
    return null;
  }

  return (
    <>
      <SubjectViewDialog
        subject={subject}
        open={dialog === "view"}
        onOpenChange={(open) => !open && onClose()}
      />
      <EditSubjectDialog
        subject={subject}
        open={dialog === "edit"}
        onOpenChange={(open) => !open && onClose()}
      />
      <ArchiveSubjectDialog
        subject={subject}
        open={dialog === "archive"}
        onOpenChange={(open) => !open && onClose()}
      />
    </>
  );
}
