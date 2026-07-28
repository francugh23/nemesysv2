"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { TeacherTableSkeleton } from "@/components/skeletons/teacher-table-skeleton";
import { useTeachers } from "@/hooks/teacher.hook";
import type { TeacherListItem } from "@/schemas";
import { useMemo, useState } from "react";

import { CreateTeacherDialog } from "./components/create-teacher-dialog";
import { TeacherEditDialog } from "./components/edit-teacher-dialog";
import { teacherColumns } from "./components/teacher-columns";
import { TeacherViewDialog } from "./components/teacher-view-dialog";

export default function TeachersPage() {
  const { data, isLoading } = useTeachers();
  const [selectedTeacher, setSelectedTeacher] =
    useState<TeacherListItem | null>(null);
  const [dialog, setDialog] = useState<"view" | "edit" | null>(null);
  const columns = useMemo(
    () =>
      teacherColumns({
        onEdit: (teacher) => {
          setSelectedTeacher(teacher);
          setDialog("edit");
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
      <Card>
        <CardHeader>
          <CardTitle>Teacher Records</CardTitle>
          <CardDescription>View teacher profiles and account status.</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-4 flex justify-end">
            <CreateTeacherDialog />
          </div>

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
              {selectedTeacher && (
                <>
                  <TeacherViewDialog
                    teacher={selectedTeacher}
                    open={dialog === "view"}
                    onOpenChange={(open) => !open && closeDialog()}
                  />
                  <TeacherEditDialog
                    teacher={selectedTeacher}
                    open={dialog === "edit"}
                    onOpenChange={(open) => !open && closeDialog()}
                  />
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
