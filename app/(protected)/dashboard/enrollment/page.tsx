"use client";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { DataTable } from "@/components/data-table";
import { EnrollmentTableSkeleton } from "@/components/skeletons/enrollment-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEnrollments } from "@/hooks/enrollment.hook";
import type { EnrollmentListItem } from "@/schemas";
import { useMemo, useState } from "react";

import { enrollmentColumns } from "./components/enrollment-columns";
import { CreateEnrollmentDialog } from "./components/create-enrollment-dialog";
import {
  EnrollmentDialogManager,
  type EnrollmentDialogType,
} from "./components/enrollment-dialog-manager";

export default function EnrollmentPage() {
  const { data, isLoading, isError, refetch, isFetching } = useEnrollments();
  const [{ selectedEnrollment, dialog, instanceId }, setDialogState] = useState<{
    selectedEnrollment: EnrollmentListItem | null;
    dialog: EnrollmentDialogType;
    instanceId: number;
  }>({
    selectedEnrollment: null,
    dialog: null,
    instanceId: 0,
  });
  const columns = useMemo(
    () =>
      enrollmentColumns({
        onEdit: (enrollment) => {
          setDialogState((current) => ({
            selectedEnrollment: enrollment,
            dialog: "edit",
            instanceId: current.instanceId + 1,
          }));
        },
      }),
    [],
  );

  function closeDialog(closingInstanceId: number) {
    setDialogState((current) =>
      current.instanceId === closingInstanceId
        ? { ...current, selectedEnrollment: null, dialog: null }
        : current,
    );
  }

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
            <DataTable
              columns={columns}
              data={data ?? []}
              onRowClick={(enrollment) => {
                setDialogState((current) => ({
                  selectedEnrollment: enrollment,
                  dialog: "view",
                  instanceId: current.instanceId + 1,
                }));
              }}
            />
          )}
          <EnrollmentDialogManager
            enrollment={selectedEnrollment}
            dialog={dialog}
            instanceId={instanceId}
            onClose={closeDialog}
          />
        </CardContent>
      </Card>
    </div>
  );
}
