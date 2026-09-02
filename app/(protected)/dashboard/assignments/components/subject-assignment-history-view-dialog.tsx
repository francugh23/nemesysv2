"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime } from "@/lib/format";
import type { SubjectAssignmentHistoryItem } from "@/schemas";

export function SubjectAssignmentHistoryViewDialog({
  assignment,
  open,
  onOpenChange,
}: {
  assignment: SubjectAssignmentHistoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!assignment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex! max-h-[92dvh] min-h-0 w-[95vw] max-w-2xl! flex-col overflow-hidden!">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle>Teaching Assignment Details</DialogTitle>
            <Badge variant={assignment.status === "ACTIVE" ? "secondary" : "outline"}>
              {assignment.status === "ACTIVE" ? "Active" : "Archived"}
            </Badge>
          </div>
        </DialogHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 pr-3">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium text-muted-foreground">
                {assignment.offering.subjectCode} | {assignment.term.name}
              </p>
              <h2 className="text-lg font-semibold">{assignment.offering.subjectDescription}</h2>
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <HistoryDetail label="Academic Year" value={assignment.academicYear.label} />
              <HistoryDetail label="Term" value={assignment.term.name} />
              <HistoryDetail label="Grade" value={`Grade ${assignment.offering.gradeLevel}`} />
              <HistoryDetail label="Section" value={`Grade ${assignment.section.gradeLevel} ${assignment.section.sectionName}`} />
              <HistoryDetail label="Teacher" value={assignment.teacher.name} />
              <HistoryDetail label="Employee Number" value={assignment.teacher.employeeNumber ?? "No employee number"} />
              <HistoryDetail label="Status" value={assignment.status === "ACTIVE" ? "Active" : "Archived"} />
              <HistoryDetail label="Created" value={formatDateTime(assignment.createdAt)} />
              <HistoryDetail label="Last updated" value={formatDateTime(assignment.updatedAt)} />
              {assignment.deletedAt && <HistoryDetail label="Archived" value={formatDateTime(assignment.deletedAt)} />}
            </dl>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
