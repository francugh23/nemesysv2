"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useQueryClient } from "@tanstack/react-query";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Input } from "@/components/ui/input";

import type { Student } from "@/app/generated/prisma/client";

import { deleteStudentAction } from "@/actions/student.action";

interface DeleteStudentDialogProps {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteStudentDialog({
  student,
  open,
  onOpenChange,
}: DeleteStudentDialogProps) {
  const [lrnInput, setLrnInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const queryClient = useQueryClient();

  const isConfirmed = lrnInput === student.lrn;

  async function handleDelete() {
    if (!isConfirmed) return;

    setIsDeleting(true);

    const result = await deleteStudentAction(student.id);

    if (result.error) {
      toast.error(result.error);
      setIsDeleting(false);
      return;
    }

    toast.success(result.success);

    await queryClient.invalidateQueries({
      queryKey: ["students"],
    });

    setIsDeleting(false);
    setLrnInput("");

    onOpenChange(false);
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(value) => {
        setLrnInput("");
        onOpenChange(value);
      }}
    >
      <AlertDialogContent className="w-[95vw] max-w-md rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Student</AlertDialogTitle>

          <AlertDialogDescription className="space-y-2">
            <span className="block">This action cannot be undone.</span>

            <span className="block">To confirm, type the LRN:</span>

            <span className="block font-semibold text-destructive">
              {student.lrn}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <div className="text-sm font-medium">Student</div>

          <div className="rounded-md border bg-muted px-3 py-2 text-sm">
            {student.lastName}, {student.firstName}
            {student.middleName && ` ${student.middleName}`}
          </div>

          <Input
            placeholder="Enter LRN"
            value={lrnInput}
            onChange={(e) => setLrnInput(e.target.value)}
          />
        </div>

        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <AlertDialogCancel className="w-full sm:w-auto">
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            disabled={!isConfirmed || isDeleting}
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 sm:w-auto"
          >
            {isDeleting ? "Deleting..." : "Delete Student"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
