"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { StudentForm } from "./student-form";

export function CreateStudentDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add Student</Button>} />

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Student</DialogTitle>
        </DialogHeader>

        <StudentForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}