"use client";

import { CrudToolbar } from "@/components/common/crud-toolbar";
import { DataTable } from "@/components/data-table";
import { SubjectAssignmentTableSkeleton } from "@/components/skeletons/subject-assignment-table-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSubjectAssignments } from "@/hooks/subject-assignment.hook";
import type { SubjectAssignmentListItem } from "@/schemas";
import { useMemo, useState } from "react";

import { subjectAssignmentColumns } from "./components/subject-assignment-columns";
import { CreateSubjectAssignmentDialog } from "./components/create-subject-assignment-dialog";
import {
  SubjectAssignmentDialogManager,
  type SubjectAssignmentDialogType,
} from "./components/subject-assignment-dialog-manager";

export default function SubjectAssignmentsPage() {
  const { data, isLoading, isError, refetch, isFetching } =
    useSubjectAssignments();
  const [{ selectedAssignment, dialog, instanceId }, setDialogState] = useState<{
    selectedAssignment: SubjectAssignmentListItem | null;
    dialog: SubjectAssignmentDialogType;
    instanceId: number;
  }>({
    selectedAssignment: null,
    dialog: null,
    instanceId: 0,
  });
  const columns = useMemo(
    () =>
      subjectAssignmentColumns({
        onEdit: (assignment) => {
          setDialogState((current) => ({
            selectedAssignment: assignment,
            dialog: "edit",
            instanceId: current.instanceId + 1,
          }));
        },
        onArchive: (assignment) => {
          setDialogState((current) => ({
            selectedAssignment: assignment,
            dialog: "archive",
            instanceId: current.instanceId + 1,
          }));
        },
      }),
    [],
  );

  function closeDialog(closingInstanceId: number) {
    setDialogState((current) =>
      current.instanceId === closingInstanceId
        ? { ...current, selectedAssignment: null, dialog: null }
        : current,
    );
  }

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
          ) : isError ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
              <div className="space-y-1">
                <p className="font-medium">
                  Unable to load subject assignments
                </p>
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
              onRowClick={(assignment) => {
                setDialogState((current) => ({
                  selectedAssignment: assignment,
                  dialog: "view",
                  instanceId: current.instanceId + 1,
                }));
              }}
            />
          )}
          <SubjectAssignmentDialogManager
            assignment={selectedAssignment}
            dialog={dialog}
            instanceId={instanceId}
            onClose={closeDialog}
          />
        </CardContent>
      </Card>
    </div>
  );
}
