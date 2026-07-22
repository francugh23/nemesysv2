"use client";

import { Input } from "@/components/ui/input";
import { CreateStudentDialog } from "./create-student-dialog";

interface StudentToolbarProps {
  search: string;
  setSearch: (value: string) => void;
}

export function StudentToolbar({ search, setSearch }: StudentToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Input
        placeholder="Search students..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />
      <CreateStudentDialog />
    </div>
  );
}
