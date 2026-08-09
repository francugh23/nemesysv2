"use client";

import { CirclePlus } from "lucide-react";
import { useState } from "react";

import { FormDialog } from "@/components/common/dialogs/form-dialog";
import { Button } from "@/components/ui/button";

import { CreateAcademicYearForm } from "./create-academic-year-form";

export function CreateAcademicYearDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <CirclePlus />
        Add Academic Year
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Create Academic Year"
        maxWidth="max-w-xl!"
      >
        <CreateAcademicYearForm onSuccess={() => setOpen(false)} />
      </FormDialog>
    </>
  );
}
