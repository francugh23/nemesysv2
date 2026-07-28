"use client";

import { DataTable } from "@/components/data-table";
import { SubjectTableSkeleton } from "@/components/skeletons/subject-table-skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSubjects } from "@/hooks/subject.hook";

import { CreateSubjectDialog } from "./components/create-subject-dialog";
import { subjectColumns } from "./components/subject-columns";

export default function SubjectsPage() {
  const { data, isLoading } = useSubjects();

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Subject Records</CardTitle>
          <CardDescription>View available subjects by grade level.</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="mb-4 flex justify-end">
            <CreateSubjectDialog />
          </div>

          {isLoading ? (
            <SubjectTableSkeleton />
          ) : (
            <DataTable columns={subjectColumns} data={data ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
