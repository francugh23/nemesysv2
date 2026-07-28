"use client";

import { useState } from "react";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";

import { TeacherForm } from "./teacher-form";

export function CreateTeacherDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Teacher</Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Create Teacher">
        <TeacherForm onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
