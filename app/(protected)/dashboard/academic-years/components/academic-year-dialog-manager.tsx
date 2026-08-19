"use client";

import type { AcademicYearListItem } from "@/schemas";

import { AcademicYearLifecycleDialog } from "./academic-year-lifecycle-dialog";
import { AcademicYearViewDialog } from "./academic-year-view-dialog";
import { EditAcademicYearDialog } from "./edit-academic-year-dialog";
import { CurriculumAdoptionDialog } from "./curriculum-adoption-dialog";

export type AcademicYearDialogType =
  | "view"
  | "edit"
  | "activate"
  | "lock"
  | "archive"
  | "adopt-curriculum"
  | null;

export function AcademicYearDialogManager({
  academicYear,
  dialog,
  instanceId,
  onClose,
  canAdoptCurriculum,
  canManageInterpretationPolicy,
  onAdoptCurriculum,
}: {
  academicYear: AcademicYearListItem | null;
  dialog: AcademicYearDialogType;
  instanceId: number;
  onClose: (instanceId: number) => void;
  canAdoptCurriculum: boolean;
  canManageInterpretationPolicy: boolean;
  onAdoptCurriculum: (academicYear: AcademicYearListItem) => void;
}) {
  if (!academicYear) return null;

  const handleOpenChange = (open: boolean) => !open && onClose(instanceId);

  return (
    <>
      <AcademicYearViewDialog
        academicYear={academicYear}
        open={dialog === "view"}
        onOpenChange={handleOpenChange}
        canAdoptCurriculum={canAdoptCurriculum}
        canManageInterpretationPolicy={canManageInterpretationPolicy}
        onAdoptCurriculum={() => onAdoptCurriculum(academicYear)}
      />
      {academicYear.status === "DRAFT" && (
        <EditAcademicYearDialog
          academicYear={academicYear}
          open={dialog === "edit"}
          onOpenChange={handleOpenChange}
        />
      )}
      {academicYear.status === "DRAFT" && canAdoptCurriculum && (
        <CurriculumAdoptionDialog
          academicYear={academicYear}
          open={dialog === "adopt-curriculum"}
          onOpenChange={handleOpenChange}
        />
      )}
      {(dialog === "activate" || dialog === "lock" || dialog === "archive") && (
        <AcademicYearLifecycleDialog
          academicYear={academicYear}
          action={dialog}
          open
          onOpenChange={handleOpenChange}
        />
      )}
    </>
  );
}
