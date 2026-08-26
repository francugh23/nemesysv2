"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/common/dialogs/confirm-delete-dialog";
import { useArchiveSubjectAssignment } from "@/hooks/subject-assignment.hook";
import { formatFullName } from "@/lib/format";
import type { SubjectAssignmentListItem } from "@/schemas";

interface ArchiveSubjectAssignmentDialogProps {
  assignment: SubjectAssignmentListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ARCHIVE_CONFIRMATION = "ARCHIVE";

export function ArchiveSubjectAssignmentDialog({
  assignment,
  open,
  onOpenChange,
}: ArchiveSubjectAssignmentDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const archiveAssignment = useArchiveSubjectAssignment();
  const isConfirmed = confirmation === ARCHIVE_CONFIRMATION;
  const teacherName = formatFullName(
    assignment.teacherFirstName,
    assignment.teacherMiddleName,
    assignment.teacherLastName,
  );
  const sectionIdentity = `Grade ${assignment.sectionGradeLevel} - ${assignment.sectionName}`;
  const assignmentIdentity = `${teacherName} | ${assignment.subjectCode} - ${assignment.subjectDescription} | ${sectionIdentity} | AY ${assignment.academicYearLabel}`;

  async function handleArchive() {
    if (!isConfirmed) return;

    const result = await archiveAssignment.mutateAsync(assignment.id);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    setConfirmation("");
    onOpenChange(false);
  }

  return (
    <ConfirmDeleteDialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          setConfirmation("");
        }

        onOpenChange(value);
      }}
      title="Archive Subject Assignment"
      description="This hides the Subject Assignment from active records. Historical relationships remain preserved."
      confirmLabel='To confirm, type:'
      confirmValue={ARCHIVE_CONFIRMATION}
      itemLabel="Subject Assignment"
      itemName={assignmentIdentity}
      inputValue={confirmation}
      onInputChange={setConfirmation}
      canConfirm={isConfirmed}
      isDeleting={archiveAssignment.isPending}
      actionLabel="Archive"
      processingLabel="Archiving..."
      onConfirm={handleArchive}
    />
  );
}
