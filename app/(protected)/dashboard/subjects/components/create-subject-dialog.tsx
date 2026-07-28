"use client";

import { useState } from "react";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";

import { SubjectForm } from "./subject-form";

export function CreateSubjectDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Subject</Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Create Subject">
        <SubjectForm onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
