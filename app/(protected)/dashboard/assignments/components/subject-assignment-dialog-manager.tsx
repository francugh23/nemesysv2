"use client";

import type { SubjectAssignmentListItem } from "@/schemas";

import { EditSubjectAssignmentDialog } from "./edit-subject-assignment-dialog";
import { SubjectAssignmentViewDialog } from "./subject-assignment-view-dialog";

export type SubjectAssignmentDialogType = "view" | "edit" | null;

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
    </>
  );
}
