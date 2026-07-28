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

import { teacherColumns } from "./components/teacher-columns";

export default function TeachersPage() {
  const { data, isLoading } = useTeachers();

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Teacher Records</CardTitle>
          <CardDescription>View teacher profiles and account status.</CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <TeacherTableSkeleton />
          ) : (
            <DataTable columns={teacherColumns} data={data ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
