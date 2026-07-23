"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { FormDialog } from "@/components/common/dialogs/form-dialog";

import { StudentForm } from "./student-form";

export function CreateStudentDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Student</Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Create Student">
        <StudentForm onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
