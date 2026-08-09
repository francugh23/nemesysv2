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
import {
  useActivateAcademicYear,
  useArchiveAcademicYear,
  useLockAcademicYear,
} from "@/hooks/academic-year.hook";
import type { AcademicYearListItem } from "@/schemas";

export type AcademicYearLifecycleAction = "activate" | "lock" | "archive";

const lifecycleCopy = {
  activate: {
    title: "Activate Academic Year",
    description:
      "Activate this academic year? Activation fails while another academic year is active.",
    action: "Activate",
    pending: "Activating...",
  },
  lock: {
    title: "Lock Academic Year",
    description:
      "Lock this academic year? It and its Enrollment and Subject Assignment history will become read-only.",
    action: "Lock",
    pending: "Locking...",
  },
  archive: {
    title: "Archive Academic Year",
    description:
      "Archive this academic year? It will remain available for historical records.",
    action: "Archive",
    pending: "Archiving...",
  },
} as const;

export function AcademicYearLifecycleDialog({
  academicYear,
  action,
  open,
  onOpenChange,
}: {
  academicYear: AcademicYearListItem;
  action: AcademicYearLifecycleAction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const activateAcademicYear = useActivateAcademicYear();
  const lockAcademicYear = useLockAcademicYear();
  const archiveAcademicYear = useArchiveAcademicYear();
  const mutation =
    action === "activate"
      ? activateAcademicYear
      : action === "lock"
        ? lockAcademicYear
        : archiveAcademicYear;
  const copy = lifecycleCopy[action];

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && mutation.isPending) return;
    onOpenChange(nextOpen);
  }

  async function handleConfirm() {
    try {
      const result = await mutation.mutateAsync(academicYear.id);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      onOpenChange(false);
    } catch {
      toast.error(`Unable to ${action} the academic year. Try again.`);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="w-[95vw] max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {copy.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border bg-muted px-3 py-2 text-sm font-medium">
          {academicYear.label}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            variant={action === "archive" ? "destructive" : "default"}
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {mutation.isPending ? copy.pending : copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
