"use client";

import { useState } from "react";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";

import { CreateSubjectForm } from "./create-subject-form";
import { CirclePlus } from "lucide-react";

export function CreateSubjectDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CirclePlus />
        Add Subject
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Create Subject">
        <CreateSubjectForm onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
