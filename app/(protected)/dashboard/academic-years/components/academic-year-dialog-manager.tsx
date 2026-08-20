"use client";

import type { AcademicYearListItem } from "@/schemas";

import { AcademicYearLifecycleDialog } from "./academic-year-lifecycle-dialog";
import { AcademicYearViewDialog } from "./academic-year-view-dialog";
import { EditAcademicYearDialog } from "./edit-academic-year-dialog";
import { CurriculumAdoptionDialog } from "./curriculum-adoption-dialog";
import { ShsElectiveEnrollmentPolicyDialog } from "./shs-elective-enrollment-policy-dialog";
import { ShsTermResultInterpretationPolicyDialog } from "./shs-term-result-interpretation-policy-dialog";

export type AcademicYearDialogType =
  | "view"
  | "edit"
  | "activate"
  | "lock"
  | "archive"
  | "adopt-curriculum"
  | "elective-policies"
  | "result-interpretation-policy"
  | null;

export function AcademicYearDialogManager({
  academicYear,
  dialog,
  instanceId,
  onClose,
  canAdoptCurriculum,
  canFinalizeCurriculum,
  canManageElectivePolicy,
  canManageInterpretationPolicy,
  onAdoptCurriculum,
  onManageElectivePolicy,
  onManageInterpretationPolicy,
}: {
  academicYear: AcademicYearListItem | null;
  dialog: AcademicYearDialogType;
  instanceId: number;
  onClose: (instanceId: number) => void;
  canAdoptCurriculum: boolean;
  canFinalizeCurriculum: boolean;
  canManageElectivePolicy: boolean;
  canManageInterpretationPolicy: boolean;
  onAdoptCurriculum: (academicYear: AcademicYearListItem) => void;
  onManageElectivePolicy: (academicYear: AcademicYearListItem) => void;
  onManageInterpretationPolicy: (academicYear: AcademicYearListItem) => void;
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
        canFinalizeCurriculum={canFinalizeCurriculum}
        canManageElectivePolicy={canManageElectivePolicy}
        canManageInterpretationPolicy={canManageInterpretationPolicy}
        onAdoptCurriculum={onAdoptCurriculum}
        onManageElectivePolicy={onManageElectivePolicy}
        onManageInterpretationPolicy={onManageInterpretationPolicy}
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
      {canManageElectivePolicy && (
        <ShsElectiveEnrollmentPolicyDialog
          academicYear={academicYear}
          open={dialog === "elective-policies"}
          onOpenChange={handleOpenChange}
          curriculumFinalized={Boolean(academicYear.curriculumFinalization)}
        />
      )}
      {canManageInterpretationPolicy && (
        <ShsTermResultInterpretationPolicyDialog
          academicYear={academicYear}
          open={dialog === "result-interpretation-policy"}
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
