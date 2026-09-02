"use client";

import { useMemo, useState } from "react";

import { DataTable } from "@/components/data-table";
import { SegmentedNavigation } from "@/components/common/segmented-navigation";
import { SubjectAssignmentTableSkeleton } from "@/components/skeletons/subject-assignment-table-skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useAssignmentMatrix,
  useSubjectAssignments,
} from "@/hooks/subject-assignment.hook";
import type { SubjectAssignmentListItem } from "@/schemas";

import { subjectAssignmentColumns } from "./components/subject-assignment-columns";
import {
  SubjectAssignmentDialogManager,
  type SubjectAssignmentDialogType,
} from "./components/subject-assignment-dialog-manager";
import { AssignmentMatrix } from "./components/assignment-matrix";

export default function SubjectAssignmentsPage() {
  const { data, isLoading, isError, refetch, isFetching } =
    useSubjectAssignments();
  const [view, setView] = useState<"matrix" | "history">("matrix");
  const [gradeLevel, setGradeLevel] = useState<
    "7" | "8" | "9" | "10" | "11" | "12"
  >("7");
  const [termId, setTermId] = useState<string | null>(null);
  const matrixQuery = useAssignmentMatrix({ gradeLevel });
  const [{ selectedAssignment, dialog, instanceId }, setDialogState] =
    useState<{
      selectedAssignment: SubjectAssignmentListItem | null;
      dialog: SubjectAssignmentDialogType;
      instanceId: number;
    }>({ selectedAssignment: null, dialog: null, instanceId: 0 });
  const selectedTerm = matrixQuery.data?.terms.find(
    (term) => term.id === termId,
  );
  const columns = useMemo(
    () =>
      subjectAssignmentColumns({
        readOnly: true,
        onEdit: (assignment) =>
          setDialogState((current) => ({
            selectedAssignment: assignment,
            dialog: "edit",
            instanceId: current.instanceId + 1,
          })),
        onArchive: (assignment) =>
          setDialogState((current) => ({
            selectedAssignment: assignment,
            dialog: "archive",
            instanceId: current.instanceId + 1,
          })),
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
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Teaching Assignments</h1>
        <p className="text-sm text-muted-foreground">
          Review teaching coverage and assign Teachers by grade, Term, and
          Section.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
            <SegmentedNavigation ariaLabel="Teaching assignment view">
              <button
                type="button"
                aria-pressed={view === "matrix"}
                className={cn(
                  buttonVariants({
                    variant: view === "matrix" ? "secondary" : "ghost",
                    size: "sm",
                  }),
                )}
                onClick={() => setView("matrix")}
              >
                Teaching Matrix
              </button>
              <button
                type="button"
                aria-pressed={view === "history"}
                className={cn(
                  buttonVariants({
                    variant: view === "history" ? "secondary" : "ghost",
                    size: "sm",
                  }),
                )}
                onClick={() => setView("history")}
              >
                History
              </button>
            </SegmentedNavigation>
            {view === "matrix" && (
              <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-[minmax(9rem,auto)_minmax(12rem,auto)]">
                <div className="space-y-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor="assignment-grade"
                  >
                    Grade
                  </label>
                  <Select
                    value={gradeLevel}
                    onValueChange={(value) => {
                      setGradeLevel(value as typeof gradeLevel);
                      setTermId(null);
                    }}
                  >
                    <SelectTrigger
                      id="assignment-grade"
                      aria-label="Grade"
                      className="w-full min-w-32"
                    >
                      <SelectValue>Grade {gradeLevel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {["7", "8", "9", "10", "11", "12"].map((grade) => (
                        <SelectItem key={grade} value={grade}>
                          Grade {grade}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label
                    className="text-sm font-medium"
                    htmlFor="assignment-term"
                  >
                    Term focus
                  </label>
                  <Select
                    value={termId ?? "ALL"}
                    onValueChange={(value) =>
                      setTermId(value === "ALL" ? null : (value ?? null))
                    }
                  >
                    <SelectTrigger
                      id="assignment-term"
                      className="w-full min-w-48"
                    >
                      <SelectValue>
                        {termId
                          ? (selectedTerm?.name ?? "Selected Term")
                          : "All Terms"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Terms</SelectItem>
                      {matrixQuery.data?.terms.map((term) => (
                        <SelectItem key={term.id} value={term.id}>
                          {term.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          {view === "matrix" && (
            <div className="text-sm text-muted-foreground">
              {matrixQuery.data?.academicYear.label ?? "Active Academic Year"}
            </div>
          )}
          {view === "matrix" ? (
            matrixQuery.isLoading ? (
              <SubjectAssignmentTableSkeleton />
            ) : matrixQuery.isError ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Unable to load the teaching matrix.
              </div>
            ) : matrixQuery.data ? (
              <AssignmentMatrix matrix={matrixQuery.data} termId={termId} />
            ) : null
          ) : isLoading ? (
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
              onRowClick={(assignment) =>
                setDialogState((current) => ({
                  selectedAssignment: assignment,
                  dialog: "view",
                  instanceId: current.instanceId + 1,
                }))
              }
            />
          )}
          {view === "history" && (
            <SubjectAssignmentDialogManager
              assignment={selectedAssignment}
              dialog={dialog}
              instanceId={instanceId}
              onClose={closeDialog}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
