"use client";

import { useState } from "react";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";

import { CreateSectionForm } from "./create-section-form";
import { CirclePlus } from "lucide-react";

export function CreateSectionDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CirclePlus />
        Add Section
      </Button>
      <FormDialog open={open} onOpenChange={setOpen} title="Create Section">
        <CreateSectionForm onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
