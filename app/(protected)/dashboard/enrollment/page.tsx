"use client";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { DataTable } from "@/components/data-table";
import { EnrollmentTableSkeleton } from "@/components/skeletons/enrollment-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEnrollments } from "@/hooks/enrollment.hook";

import { enrollmentColumns } from "./components/enrollment-columns";
import { CreateEnrollmentDialog } from "./components/create-enrollment-dialog";

export default function EnrollmentPage() {
  const { data, isLoading, isError, refetch, isFetching } = useEnrollments();

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Enrollment Records</h1>
          <p className="text-sm text-muted-foreground">
            View student enrollment records by section and academic year.
          </p>
        </div>

        <CrudToolbar primaryAction={<CreateEnrollmentDialog />} />
      </div>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <EnrollmentTableSkeleton />
          ) : isError ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="space-y-1">
                <p className="font-medium">Unable to load enrollment records</p>
                <p className="text-sm text-muted-foreground">
                  Check your connection and try again.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? "Retrying..." : "Try again"}
              </Button>
            </div>
          ) : (
            <DataTable columns={enrollmentColumns} data={data ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
