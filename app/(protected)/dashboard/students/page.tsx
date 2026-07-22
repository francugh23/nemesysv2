"use client";

import { DataTable } from "@/components/data-table";
import { useState } from "react";

import { useStudents } from "@/hooks/student.hook";

import { studentColumns } from "./components/student-columns";
import { StudentToolbar } from "./components/student-toolbar";

export default function StudentsPage() {
  const { data, isLoading } = useStudents();
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Students</h1>

          <p className="text-muted-foreground">Manage student records.</p>
        </div>

        <StudentToolbar search={search} setSearch={setSearch} />
      </div>

      <DataTable columns={studentColumns} data={data ?? []} search={search} />
    </div>
  );
}
