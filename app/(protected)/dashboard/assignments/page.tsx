"use client";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { DataTable } from "@/components/data-table";
import { SubjectAssignmentTableSkeleton } from "@/components/skeletons/subject-assignment-table-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useSubjectAssignments } from "@/hooks/subject-assignment.hook";

import { subjectAssignmentColumns } from "./components/subject-assignment-columns";
import { CreateSubjectAssignmentDialog } from "./components/create-subject-assignment-dialog";

export default function SubjectAssignmentsPage() {
  const { data, isLoading } = useSubjectAssignments();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Subject Assignments</h1>
          <p className="text-sm text-muted-foreground">
            View teacher subject assignments by section and academic year.
          </p>
        </div>

        <CrudToolbar primaryAction={<CreateSubjectAssignmentDialog />} />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <SubjectAssignmentTableSkeleton />
          ) : (
            <DataTable columns={subjectAssignmentColumns} data={data ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
