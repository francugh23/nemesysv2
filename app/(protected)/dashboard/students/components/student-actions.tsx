"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Student } from "@/app/generated/prisma/client";

import { StudentViewDialog } from "./student-view-dialog";
import { StudentEditDialog } from "./edit-student-dialog";
import { DeleteStudentDialog } from "./delete-student-dialog";

interface StudentActionsProps {
  student: Student;
}

export function StudentActions({ student }: StudentActionsProps) {
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />

        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setViewOpen(true)}>
            View
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setEditOpen(true)}>
            Edit
          </DropdownMenuItem>

          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <StudentViewDialog
        student={student}
        open={viewOpen}
        onOpenChange={setViewOpen}
      />

      <StudentEditDialog
        student={student}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <DeleteStudentDialog
        student={student}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
