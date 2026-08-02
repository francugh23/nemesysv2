"use client";

import type { SubjectAssignmentListItem } from "@/schemas";

import { ArchiveSubjectAssignmentDialog } from "./archive-subject-assignment-dialog";
import { EditSubjectAssignmentDialog } from "./edit-subject-assignment-dialog";
import { SubjectAssignmentViewDialog } from "./subject-assignment-view-dialog";

export type SubjectAssignmentDialogType = "view" | "edit" | "archive" | null;

interface SubjectAssignmentDialogManagerProps {
  assignment: SubjectAssignmentListItem | null;
  dialog: SubjectAssignmentDialogType;
  instanceId: number;
  onClose: (instanceId: number) => void;
}

export function SubjectAssignmentDialogManager({
  assignment,
  dialog,
  instanceId,
  onClose,
}: SubjectAssignmentDialogManagerProps) {
  if (!assignment) {
    return null;
  }

  return (
    <>
      <SubjectAssignmentViewDialog
        assignment={assignment}
        open={dialog === "view"}
        onOpenChange={(open) => !open && onClose(instanceId)}
      />
      <EditSubjectAssignmentDialog
        assignment={assignment}
        open={dialog === "edit"}
        onOpenChange={(open) => !open && onClose(instanceId)}
      />
      <ArchiveSubjectAssignmentDialog
        assignment={assignment}
        open={dialog === "archive"}
        onOpenChange={(open) => !open && onClose(instanceId)}
      />
    </>
  );
}
