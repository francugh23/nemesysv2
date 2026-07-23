"use client";

import type { Student } from "@/app/generated/prisma/client";

import { StudentViewDialog } from "./student-view-dialog";
import { StudentEditDialog } from "./edit-student-dialog";
import { DeleteStudentDialog } from "./delete-student-dialog";

export type StudentDialogType = "view" | "edit" | "delete" | null;

interface StudentDialogManagerProps {
  student: Student | null;

  dialog: StudentDialogType;

  onClose: () => void;
}

export function StudentDialogManager({
  student,
  dialog,
  onClose,
}: StudentDialogManagerProps) {
  return (
    <>
      {student && (
        <>
          <StudentViewDialog
            student={student}
            open={dialog === "view"}
            onOpenChange={(open) => !open && onClose()}
          />

          <StudentEditDialog
            student={student}
            open={dialog === "edit"}
            onOpenChange={(open) => !open && onClose()}
          />

          <DeleteStudentDialog
            student={student}
            open={dialog === "delete"}
            onOpenChange={(open) => !open && onClose()}
          />
        </>
      )}
    </>
  );
}