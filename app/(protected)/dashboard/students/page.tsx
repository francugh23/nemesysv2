"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { CrudToolbar } from "@/components/common/crud-toolbar";
import { ExportButton } from "@/components/common/export/export-button";
import { Button } from "@/components/ui/button";
import { useMemo, useRef, useState } from "react";
import type { Table } from "@tanstack/react-table";

import { useStudents } from "@/hooks/student.hook";

import { studentColumns } from "./components/student-columns";
import { StudentToolbar } from "./components/student-toolbar";
import { StudentTableSkeleton } from "@/components/skeletons/student-table-skeleton";
import { Student } from "@/app/generated/prisma/client";
import {
  StudentDialogManager,
  StudentDialogType,
} from "./components/student-dialog-manager";
import { CreateStudentDialog } from "./components/create-student-dialog";
import { StudentImportDialog } from "./components/student-import-dialog";
import { studentExportDefinition } from "./components/student-export";

export default function StudentsPage() {
  const { data, isLoading } = useStudents();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [dialog, setDialog] = useState<StudentDialogType>(null);
  const tableRef = useRef<Table<Student> | null>(null);

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
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Student Records</h1>
          <p className="text-sm text-muted-foreground">
            Search, filter and manage students.
          </p>
        </div>

        <CrudToolbar
          primaryAction={<CreateStudentDialog />}
          actions={
            <>
              <StudentImportDialog
                trigger={<Button variant="outline">Import Student</Button>}
              />
              <ExportButton
                getRecords={() =>
                  tableRef.current?.getFilteredRowModel().rows.map((row) => row.original) ?? []
                }
                definition={studentExportDefinition}
              />
            </>
          }
        />
      </div>

      <Card>
        <CardContent className="pt-6">
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
                tableRef={tableRef}
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
