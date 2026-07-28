"use client";

import type { TeacherListItem } from "@/schemas";

import { DeactivateTeacherDialog } from "./deactivate-teacher-dialog";
import { TeacherEditDialog } from "./edit-teacher-dialog";
import { TeacherViewDialog } from "./teacher-view-dialog";

export type TeacherDialogType = "view" | "edit" | "deactivate" | null;

interface TeacherDialogManagerProps {
  teacher: TeacherListItem | null;
  dialog: TeacherDialogType;
  onClose: () => void;
}

export function TeacherDialogManager({
  teacher,
  dialog,
  onClose,
}: TeacherDialogManagerProps) {
  if (!teacher) {
    return null;
  }

  return (
    <>
      <TeacherViewDialog
        teacher={teacher}
        open={dialog === "view"}
        onOpenChange={(open) => !open && onClose()}
      />
      <TeacherEditDialog
        teacher={teacher}
        open={dialog === "edit"}
        onOpenChange={(open) => !open && onClose()}
      />
      <DeactivateTeacherDialog
        teacher={teacher}
        open={dialog === "deactivate"}
        onOpenChange={(open) => !open && onClose()}
      />
    </>
  );
}
