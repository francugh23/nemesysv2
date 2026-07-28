"use client";

import { useState } from "react";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";

import { CreateSubjectAssignmentForm } from "./create-subject-assignment-form";

export function CreateSubjectAssignmentDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Assignment</Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Create Assignment">
        <CreateSubjectAssignmentForm onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
