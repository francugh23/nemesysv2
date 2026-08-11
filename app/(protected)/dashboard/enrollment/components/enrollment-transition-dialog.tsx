"use client";

import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTransitionEnrollment } from "@/hooks/enrollment.hook";
import { formatFullName } from "@/lib/format";
import type {
  EnrollmentListItem,
  TransitionEnrollmentInput,
} from "@/schemas";

const transitionCopy = {
  COMPLETED: {
    title: "Complete Enrollment",
    description:
      "Completion is terminal and cannot be reopened. The student's current Section will be cleared. Subject enrollment history remains available, but SSHS curriculum selection becomes read-only.",
    action: "Mark Completed",
    pending: "Completing...",
  },
  DROPPED: {
    title: "Withdraw / Unenroll Student",
    description:
      "This records the Enrollment as DROPPED, clears the student's current Section, and synchronizes the student status to Dropped. The transition is terminal. Subject enrollment history remains available, but SSHS curriculum selection becomes read-only.",
    action: "Withdraw / Unenroll",
    pending: "Withdrawing...",
  },
  TRANSFERRED: {
    title: "Transfer Student",
    description:
      "Transfer is terminal, clears the student's current Section, and synchronizes the student status to Transferred. Subject enrollment history remains available, but SSHS curriculum selection becomes read-only.",
    action: "Mark Transferred",
    pending: "Transferring...",
  },
} as const;

export function EnrollmentTransitionDialog({
  enrollment,
  status,
  open,
  onOpenChange,
}: {
  enrollment: EnrollmentListItem;
  status: TransitionEnrollmentInput["status"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const transition = useTransitionEnrollment();
  const copy = transitionCopy[status];
  const operational =
    enrollment.status === "ACTIVE" &&
    enrollment.academicYearStatus === "ACTIVE";

  async function handleConfirm() {
    const result = await transition.mutateAsync({
      id: enrollment.id,
      values: { status },
    });
    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    onOpenChange(false);
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[95vw] max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm">
          <p className="font-medium">
            {formatFullName(
              enrollment.studentFirstName,
              enrollment.studentMiddleName,
              enrollment.studentLastName,
            )}
          </p>
          <p className="text-muted-foreground">
            {enrollment.studentLrn} | {enrollment.academicYear} | Current state:{" "}
            {enrollment.status}
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={transition.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={status === "DROPPED" ? "destructive" : "default"}
            disabled={transition.isPending || !operational}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {transition.isPending ? copy.pending : copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
