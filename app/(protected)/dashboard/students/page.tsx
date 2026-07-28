"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { useMemo, useState } from "react";

import { useStudents } from "@/hooks/student.hook";

import { studentColumns } from "./components/student-columns";
import { StudentToolbar } from "./components/student-toolbar";
import { StudentTableSkeleton } from "@/components/skeletons/student-table-skeleton";
import { Student } from "@/app/generated/prisma/client";
import {
  StudentDialogManager,
  StudentDialogType,
} from "./components/student-dialog-manager";
import { StudentImportDialog } from "./components/student-import-dialog";

export default function StudentsPage() {
  const { data, isLoading } = useStudents();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [dialog, setDialog] = useState<StudentDialogType>(null);

  const columns = useMemo(
    () =>
      studentColumns({
        onEdit: (student) => {
          setSelectedStudent(student);
          setDialog("edit");
        },

        onDelete: (student) => {
          setSelectedStudent(student);
          setDialog("delete");
        },
      }),
    [],
  );
  return (
    <div className="space-y-6 p-6">
      <StudentImportDialog />
      <Card>
        <CardHeader>
          <CardTitle>Student Records</CardTitle>
          <CardDescription>Search, filter and manage students.</CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <StudentTableSkeleton />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={data ?? []}
                onRowClick={(student) => {
                  setSelectedStudent(student);
                  setDialog("view");
                }}
                toolbar={(table) => <StudentToolbar table={table} />}
              />
              <StudentDialogManager
                student={selectedStudent}
                dialog={dialog}
                onClose={() => {
                  setSelectedStudent(null);
                  setDialog(null);
                }}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
