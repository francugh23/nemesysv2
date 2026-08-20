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
import { useFinalizeCurriculum } from "@/hooks/academic-year.hook";

export function CurriculumFinalizationDialog({
  academicYearId,
  academicYearLabel,
  pendingShsOfferingCount,
  open,
  onOpenChange,
}: {
  academicYearId: string;
  academicYearLabel: string;
  pendingShsOfferingCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const finalize = useFinalizeCurriculum();
  const blocked = pendingShsOfferingCount > 0;

  async function handleConfirm() {
    const result = await finalize.mutateAsync(academicYearId);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(result.success);
    onOpenChange(false);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && finalize.isPending) return;
        onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent className="w-[95vw] max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Finalize Curriculum</AlertDialogTitle>
          <AlertDialogDescription>
            Finalization permanently freezes ordinary Curriculum configuration for {academicYearLabel}.
            It does not close Enrollment, SHS progression, results, or the Academic Year.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {blocked ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {pendingShsOfferingCount} active SHS Offering{pendingShsOfferingCount === 1 ? " is" : "s are"} missing SHS context or Pending School Approval. Complete, approve, or archive {pendingShsOfferingCount === 1 ? "it" : "them"} before finalization.
          </p>
        ) : (
          <p className="rounded-md border bg-muted px-3 py-2 text-sm">
            Missing grade coverage or elective-policy scopes remain warnings and do not block finalization.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={finalize.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={blocked || finalize.isPending}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
          >
            {finalize.isPending ? "Finalizing..." : "Finalize Curriculum"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
