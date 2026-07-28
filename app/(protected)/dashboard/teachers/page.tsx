"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { CrudToolbar } from "@/components/common/crud-toolbar";
import { TeacherTableSkeleton } from "@/components/skeletons/teacher-table-skeleton";
import { useTeachers } from "@/hooks/teacher.hook";
import type { TeacherListItem } from "@/schemas";
import { useMemo, useState } from "react";

import { CreateTeacherDialog } from "./components/create-teacher-dialog";
import {
  TeacherDialogManager,
  TeacherDialogType,
} from "./components/teacher-dialog-manager";
import { teacherColumns } from "./components/teacher-columns";

export default function TeachersPage() {
  const { data, isLoading } = useTeachers();
  const [selectedTeacher, setSelectedTeacher] =
    useState<TeacherListItem | null>(null);
  const [dialog, setDialog] = useState<TeacherDialogType>(null);
  const columns = useMemo(
    () =>
      teacherColumns({
        onEdit: (teacher) => {
          setSelectedTeacher(teacher);
          setDialog("edit");
        },
        onDeactivate: (teacher) => {
          setSelectedTeacher(teacher);
          setDialog("deactivate");
        },
      }),
    [],
  );

  function closeDialog() {
    setSelectedTeacher(null);
    setDialog(null);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Teacher Records</h1>
          <p className="text-sm text-muted-foreground">
            View teacher profiles and account status.
          </p>
        </div>

        <CrudToolbar primaryAction={<CreateTeacherDialog />} />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <TeacherTableSkeleton />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={data ?? []}
                onRowClick={(teacher) => {
                  setSelectedTeacher(teacher);
                  setDialog("view");
                }}
              />
              <TeacherDialogManager
                teacher={selectedTeacher}
                dialog={dialog}
                onClose={closeDialog}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
