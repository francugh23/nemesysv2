"use client";

import type { EnrollmentListItem } from "@/schemas";

import { CorrectEnrollmentPlacementDialog } from "./correct-enrollment-placement-dialog";
import { EnrollmentTransitionDialog } from "./enrollment-transition-dialog";
import { EnrollmentViewDialog } from "./enrollment-view-dialog";

export type EnrollmentDialogType =
  | "view"
  | "correct-placement"
  | "COMPLETED"
  | "DROPPED"
  | "TRANSFERRED"
  | null;

interface EnrollmentDialogManagerProps {
  enrollment: EnrollmentListItem | null;
  dialog: EnrollmentDialogType;
  instanceId: number;
  canCorrectPlacement: boolean;
  onClose: (instanceId: number) => void;
  onSelectDialog: (dialog: EnrollmentDialogType) => void;
}

export function EnrollmentDialogManager({
  enrollment,
  dialog,
  instanceId,
  canCorrectPlacement,
  onClose,
  onSelectDialog,
}: EnrollmentDialogManagerProps) {
  if (!enrollment) {
    return null;
  }
  const canOpenPlacementCorrection = canCorrectPlacement &&
    enrollment.status === "ACTIVE" && enrollment.academicYearStatus === "ACTIVE";

  return (
    <>
      <EnrollmentViewDialog
        enrollment={enrollment}
        open={dialog === "view"}
        onOpenChange={(open) => !open && onClose(instanceId)}
        canViewPlacementCorrections={canCorrectPlacement}
        onCorrectPlacement={canOpenPlacementCorrection ? () => onSelectDialog("correct-placement") : undefined}
      />
      {canOpenPlacementCorrection ? (
        <CorrectEnrollmentPlacementDialog
          key={`${enrollment.id}-${instanceId}`}
          enrollment={enrollment}
          open={dialog === "correct-placement"}
          onOpenChange={(open) => !open && onClose(instanceId)}
        />
      ) : null}
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
