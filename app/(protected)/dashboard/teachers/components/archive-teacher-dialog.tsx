"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/common/dialogs/confirm-delete-dialog";
import { useArchiveTeacher } from "@/hooks/teacher.hook";
import type { TeacherListItem } from "@/schemas";

export function ArchiveTeacherDialog({ teacher, open, onOpenChange }: { teacher: TeacherListItem; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [confirmation, setConfirmation] = useState("");
  const archiveTeacher = useArchiveTeacher();
  const confirmed = confirmation === teacher.employeeNumber;
  async function archive() {
    if (!confirmed) return;
    const result = await archiveTeacher.mutateAsync(teacher.id);
    if (result.error) return toast.error(result.error);
    toast.success(result.success);
    setConfirmation("");
    onOpenChange(false);
  }
  return <ConfirmDeleteDialog open={open} onOpenChange={(value) => { if (!value) setConfirmation(""); onOpenChange(value); }} title="Archive Teacher" description="Archived Teachers are excluded from the operational registry and retained for history." confirmLabel="To confirm, type the employee number:" confirmValue={teacher.employeeNumber} itemLabel="Teacher" itemName={`${teacher.lastName}, ${teacher.firstName}`} inputValue={confirmation} onInputChange={setConfirmation} canConfirm={confirmed} isDeleting={archiveTeacher.isPending} actionLabel="Archive" processingLabel="Archiving..." onConfirm={archive} />;
}
