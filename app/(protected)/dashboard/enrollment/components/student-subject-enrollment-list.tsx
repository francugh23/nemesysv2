"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

import { AcademicTermBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useShsCurrentTermProgression,
  useStudentSubjectEnrollments,
} from "@/hooks/student-subject-enrollment.hook";
import { formatDateTime } from "@/lib/format";
import { getPhilippineCalendarDate } from "@/lib/academic-term-current";

import { DropStudentSubjectEnrollmentDialog } from "./drop-student-subject-enrollment-dialog";
import {
  ShsTermResultDialog,
  type ShsTermResultTarget,
} from "./shs-term-result-dialog";

const statusVariants = {
  ACTIVE: "default",
  REPLACED: "secondary",
  DROPPED: "destructive",
} as const;

export function StudentSubjectEnrollmentList({
  enrollmentId,
  gradeLevel,
  enrollmentStatus,
  academicYearStatus,
  open,
}: {
  enrollmentId: string;
  gradeLevel: string;
  enrollmentStatus: "ACTIVE" | "COMPLETED" | "DROPPED" | "TRANSFERRED";
  academicYearStatus: "DRAFT" | "ACTIVE" | "LOCKED" | "ARCHIVED";
  open: boolean;
}) {
  const [showReplacementHistory, setShowReplacementHistory] = useState(false);
  const [showDroppedHistory, setShowDroppedHistory] = useState(false);
  const [dropRow, setDropRow] = useState<StudentSubjectEnrollmentRow | null>(null);
  const [resultTarget, setResultTarget] = useState<ShsTermResultTarget | null>(null);
  const { data: session } = useSession();
  const { data, isLoading, isError, isFetching, refetch } =
    useStudentSubjectEnrollments(enrollmentId, open);
  const isShs = gradeLevel === "11" || gradeLevel === "12";
  const progression = useShsCurrentTermProgression(
    enrollmentId,
    open && isShs,
  );
  const activeRows = data?.filter((row) => row.status === "ACTIVE") ?? [];
  const replacedRows = data?.filter((row) => row.status === "REPLACED") ?? [];
  const droppedRows = data?.filter((row) => row.status === "DROPPED") ?? [];
  const currentTerm =
    progression.data && "currentTerm" in progression.data
      ? progression.data.currentTerm
      : null;
  const currentActiveRows = currentTerm
    ? activeRows.filter((row) =>
        row.terms.some(
          ({ academicTermId }) => academicTermId === currentTerm.id,
        ),
      )
    : activeRows;
  const previousActiveRows = currentTerm
    ? activeRows.filter(
        (row) =>
          !row.terms.some(
            ({ academicTermId }) => academicTermId === currentTerm.id,
          ),
      )
    : [];
  const canManageDrops =
    isShs &&
    enrollmentStatus === "ACTIVE" &&
    academicYearStatus === "ACTIVE" &&
    Boolean(currentTerm);
  const canManageResults = isShs && session?.user.role === "SUPER_ADMIN";

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">Student Subject Enrollments</h3>
          <p className="text-sm text-muted-foreground">
            Current-Term participation and preserved subject enrollment history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {replacedRows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReplacementHistory((current) => !current)}
            >
              {showReplacementHistory
                ? "Hide replaced history"
                : `Show replaced history (${replacedRows.length})`}
            </Button>
          )}
          {droppedRows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDroppedHistory((current) => !current)}
            >
              {showDroppedHistory
                ? "Hide dropped history"
                : `Show dropped history (${droppedRows.length})`}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <StudentSubjectEnrollmentTableSkeleton />
      ) : isError ? (
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">Unable to load student subject enrollments</p>
          <p className="mt-1 text-muted-foreground">
            Check your connection and try again.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Retrying..." : "Try again"}
          </Button>
        </div>
      ) : currentActiveRows.length ? (
        <StudentSubjectEnrollmentTable
          rows={currentActiveRows}
          currentAcademicTermId={currentTerm?.id}
          canManageDrops={canManageDrops}
          showResults={isShs}
          canManageResults={canManageResults}
          onManageResult={setResultTarget}
          onDrop={setDropRow}
        />
      ) : (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          No current-Term subject enrollments are available for this Enrollment.
        </div>
      )}

      {previousActiveRows.length > 0 && (
        <div className="space-y-2 pt-2">
          <div>
            <h4 className="font-medium">Active Prior-Term History</h4>
            <p className="text-sm text-muted-foreground">
              Active participation outside the current Term remains read-only history here.
            </p>
          </div>
          <StudentSubjectEnrollmentTable
            rows={previousActiveRows}
            showResults={isShs}
            canManageResults={canManageResults}
            onManageResult={setResultTarget}
          />
        </div>
      )}

      {showReplacementHistory && replacedRows.length > 0 && (
        <div className="space-y-2 pt-2">
          <div>
            <h4 className="font-medium">Replacement History</h4>
            <p className="text-sm text-muted-foreground">
              Replaced subject enrollments are preserved as read-only history.
            </p>
          </div>
          <StudentSubjectEnrollmentTable rows={replacedRows} showResults={isShs} />
        </div>
      )}

      {showDroppedHistory && droppedRows.length > 0 && (
        <div className="space-y-2 pt-2">
          <div>
            <h4 className="font-medium">Dropped History</h4>
            <p className="text-sm text-muted-foreground">
              Dropped rows retain their immutable Terms and recorded reason.
            </p>
          </div>
          <StudentSubjectEnrollmentTable rows={droppedRows} showDropDetails showResults={isShs} />
        </div>
      )}

      {dropRow && (
        <DropStudentSubjectEnrollmentDialog
          enrollmentId={enrollmentId}
          subject={{
            id: dropRow.id,
            code: dropRow.subjectCode,
            description: dropRow.subjectDescription,
            terms: dropRow.terms,
          }}
          open
          onOpenChange={(nextOpen) => !nextOpen && setDropRow(null)}
        />
      )}
      {resultTarget && (
        <ShsTermResultDialog
          enrollmentId={enrollmentId}
          target={resultTarget}
          open
          onOpenChange={(nextOpen) => !nextOpen && setResultTarget(null)}
        />
      )}
    </section>
  );
}

type StudentSubjectEnrollmentRow = NonNullable<
  ReturnType<typeof useStudentSubjectEnrollments>["data"]
>[number];

function StudentSubjectEnrollmentTable({
  rows,
  currentAcademicTermId,
  canManageDrops = false,
  showDropDetails = false,
  showResults = false,
  canManageResults = false,
  onDrop,
  onManageResult,
}: {
  rows: StudentSubjectEnrollmentRow[];
  currentAcademicTermId?: string;
  canManageDrops?: boolean;
  showDropDetails?: boolean;
  showResults?: boolean;
  canManageResults?: boolean;
  onDrop?: (row: StudentSubjectEnrollmentRow) => void;
  onManageResult?: (target: ShsTermResultTarget) => void;
}) {
  const operationalDate = getPhilippineCalendarDate();
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Academic Terms</TableHead>
            {showResults && <TableHead>Term Results</TableHead>}
            <TableHead>SSHS Context</TableHead>
            <TableHead>Status</TableHead>
            {showDropDetails && <TableHead>Drop Details</TableHead>}
            {canManageDrops && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono font-medium">{row.subjectCode}</TableCell>
              <TableCell className="whitespace-normal">
                {row.subjectDescription}
              </TableCell>
              <TableCell className="whitespace-normal">
                {row.gradeLevel}
              </TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-wrap gap-1">
                  {row.terms.map((term) => (
                    <AcademicTermBadge
                      key={term.academicTermId}
                      position={term.academicTerm.position}
                      name={term.academicTerm.name}
                    />
                  ))}
                </div>
              </TableCell>
              {showResults && (
                <TableCell className="whitespace-normal">
                  <div className="space-y-2">
                    {row.terms.map((term) => (
                      <div key={term.academicTermId} className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium">{term.academicTerm.name}:</span>
                        {term.result ? (
                          <Badge variant={term.result.status === "FINALIZED" ? "default" : "secondary"}>
                            {term.result.status} | {term.result.finalResult?.toFixed(2) ?? "No result"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No result</span>
                        )}
                        {canManageResults && row.status === "ACTIVE" && term.result?.status !== "FINALIZED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={operationalDate < term.academicTerm.startDate.toISOString().slice(0, 10)}
                            onClick={() => onManageResult?.({
                              studentSubjectEnrollmentId: row.id,
                              subjectCode: row.subjectCode,
                              subjectDescription: row.subjectDescription,
                              academicTermId: term.academicTermId,
                              academicTerm: term.academicTerm,
                              result: term.result,
                            })}
                          >
                            {term.result ? "Edit Draft" : "Add Draft"}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </TableCell>
              )}
              <TableCell className="whitespace-normal">
                {row.shsCurriculumStatus ? (
                  <div className="space-y-1">
                    <Badge variant={row.shsCurriculumStatus === "SCHOOL_APPROVED" ? "default" : "secondary"}>{row.shsCurriculumStatus}</Badge>
                    <p className="text-xs text-muted-foreground">{row.shsClassification}{row.shsClusterCode ? ` | ${row.shsClusterCode}` : ""}</p>
                  </div>
                ) : "-"}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariants[row.status]}>{row.status}</Badge>
              </TableCell>
              {showDropDetails && (
                <TableCell className="max-w-xs whitespace-normal">
                  <p className="text-sm">{formatDateTime(row.droppedAt)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.dropReason}
                  </p>
                </TableCell>
              )}
              {canManageDrops && (
                <TableCell className="text-right">
                  {row.shsCurriculumStatus &&
                  row.terms.some(
                    ({ academicTermId }) =>
                      academicTermId === currentAcademicTermId,
                  ) ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDrop?.(row)}
                    >
                      Drop
                    </Button>
                  ) : null}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StudentSubjectEnrollmentTableSkeleton() {
  return (
    <div className="space-y-2 rounded-md border p-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
