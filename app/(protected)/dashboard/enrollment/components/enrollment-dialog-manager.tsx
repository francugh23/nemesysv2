"use client";

import type { EnrollmentListItem } from "@/schemas";

import { EditEnrollmentDialog } from "./edit-enrollment-dialog";
import { EnrollmentTransitionDialog } from "./enrollment-transition-dialog";
import { EnrollmentViewDialog } from "./enrollment-view-dialog";

export type EnrollmentDialogType =
  | "view"
  | "edit"
  | "COMPLETED"
  | "DROPPED"
  | "TRANSFERRED"
  | null;

interface EnrollmentDialogManagerProps {
  enrollment: EnrollmentListItem | null;
  dialog: EnrollmentDialogType;
  instanceId: number;
  onClose: (instanceId: number) => void;
}

export function EnrollmentDialogManager({
  enrollment,
  dialog,
  instanceId,
  onClose,
}: EnrollmentDialogManagerProps) {
  if (!enrollment) {
    return null;
  }

  return (
    <>
      <EnrollmentViewDialog
        enrollment={enrollment}
        open={dialog === "view"}
        onOpenChange={(open) => !open && onClose(instanceId)}
      />
      <EditEnrollmentDialog
        enrollment={enrollment}
        open={dialog === "edit"}
        onOpenChange={(open) => !open && onClose(instanceId)}
      />
      {dialog === "COMPLETED" ||
      dialog === "DROPPED" ||
      dialog === "TRANSFERRED" ? (
        <EnrollmentTransitionDialog
          enrollment={enrollment}
          status={dialog}
          open
          onOpenChange={(open) => !open && onClose(instanceId)}
        />
      ) : null}
    </>
  );
}
