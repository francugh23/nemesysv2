"use client";

import { useState } from "react";

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
import { useStudentSubjectEnrollments } from "@/hooks/student-subject-enrollment.hook";

const statusVariants = {
  ACTIVE: "default",
  REPLACED: "secondary",
} as const;

export function StudentSubjectEnrollmentList({
  enrollmentId,
  open,
}: {
  enrollmentId: string;
  open: boolean;
}) {
  const [showReplacementHistory, setShowReplacementHistory] = useState(false);
  const { data, isLoading, isError, isFetching, refetch } =
    useStudentSubjectEnrollments(enrollmentId, open);
  const activeRows = data?.filter((row) => row.status === "ACTIVE") ?? [];
  const replacedRows = data?.filter((row) => row.status === "REPLACED") ?? [];

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">Student Subject Enrollments</h3>
          <p className="text-sm text-muted-foreground">
            Active subject enrollments for this Enrollment record.
          </p>
        </div>
        {replacedRows.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReplacementHistory((current) => !current)}
          >
            {showReplacementHistory
              ? "Hide replacement history"
              : `Show replacement history (${replacedRows.length})`}
          </Button>
        )}
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
      ) : activeRows.length ? (
        <StudentSubjectEnrollmentTable rows={activeRows} />
      ) : (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">
          No active subject enrollments are available for this Enrollment.
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
          <StudentSubjectEnrollmentTable rows={replacedRows} />
        </div>
      )}
    </section>
  );
}

type StudentSubjectEnrollmentRow = NonNullable<
  ReturnType<typeof useStudentSubjectEnrollments>["data"]
>[number];

function StudentSubjectEnrollmentTable({
  rows,
}: {
  rows: StudentSubjectEnrollmentRow[];
}) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Grade</TableHead>
            <TableHead>Academic Terms</TableHead>
            <TableHead>SSHS Context</TableHead>
            <TableHead>Status</TableHead>
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
                {row.shsCurriculumStatus ? (
                  <div className="space-y-1">
                    <Badge variant={row.shsCurriculumStatus === "SCHOOL_APPROVED" ? "default" : "secondary"}>{row.shsCurriculumStatus}</Badge>
                    <p className="text-xs text-muted-foreground">{row.shsClassification}{row.shsClusterCode ? ` | ${row.shsClusterCode}` : ""}</p>
                  </div>
                ) : "-"}
              </TableCell>
              <TableCell>{row.gradeLevel}</TableCell>
              <TableCell className="whitespace-normal">
                <div className="flex flex-wrap gap-1">
                  {row.terms.map((term) => (
                    <Badge key={term.academicTermId} variant="outline">
                      {term.academicTerm.position}. {term.academicTerm.name}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariants[row.status]}>{row.status}</Badge>
              </TableCell>
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
