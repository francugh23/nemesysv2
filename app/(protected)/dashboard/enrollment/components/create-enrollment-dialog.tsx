"use client";

import { useState } from "react";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";

import { CreateEnrollmentForm } from "./create-enrollment-form";

export function CreateEnrollmentDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add Enrollment</Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Create Enrollment">
        <CreateEnrollmentForm onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
