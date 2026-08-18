"use client";

import { useState } from "react";
import { toast } from "sonner";

import { AcademicTermBadge } from "@/components/common/badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useDropShsStudentSubjectEnrollment } from "@/hooks/student-subject-enrollment.hook";

interface DropSubject {
  id: string;
  code: string;
  description: string;
  terms: Array<{
    academicTermId: string;
    academicTerm: { name: string; position: number };
  }>;
}

export function DropStudentSubjectEnrollmentDialog({
  enrollmentId,
  subject,
  open,
  onOpenChange,
}: {
  enrollmentId: string;
  subject: DropSubject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState("");
  const dropSubject = useDropShsStudentSubjectEnrollment(enrollmentId);
  const trimmedReason = reason.trim();
  const reasonInvalid = trimmedReason.length === 0 || trimmedReason.length > 500;

  async function submit() {
    try {
      const result = await dropSubject.mutateAsync({
        enrollmentId,
        studentSubjectEnrollmentId: subject.id,
        reason: trimmedReason,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (!result.data) {
        toast.error("The drop result could not be confirmed. Refresh and try again.");
        return;
      }

      const exception = result.data.policyException;
      if (exception) {
        toast.warning(result.success, {
          description: `The resulting elective count is ${exception.resultingElectiveCount}, below the policy minimum of ${exception.minimumElectives}.`,
        });
      } else {
        toast.success(result.success);
      }
      onOpenChange(false);
    } catch {
      toast.error("Unable to drop SHS subject participation. Try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>Drop SHS Subject Participation</DialogTitle>
          <DialogDescription>
            This marks the entire immutable subject enrollment row as DROPPED.
            Every attached Term, including prior and future Terms, stays on that
            historical row. The parent Enrollment is unchanged and no
            replacement is created.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p>
            <span className="font-mono font-medium">{subject.code}</span> |{" "}
            {subject.description}
          </p>
          <div className="flex flex-wrap gap-1">
            {subject.terms.map((term) => (
              <AcademicTermBadge
                key={term.academicTermId}
                position={term.academicTerm.position}
                name={term.academicTerm.name}
              />
            ))}
          </div>
        </div>

        <Field data-invalid={reason.length > 500 || undefined}>
          <FieldLabel htmlFor="drop-subject-reason">Reason</FieldLabel>
          <Textarea
            id="drop-subject-reason"
            value={reason}
            maxLength={500}
            rows={4}
            placeholder="Enter the reason for dropping this subject participation."
            aria-invalid={reason.length > 500 || undefined}
            onChange={(event) => setReason(event.target.value)}
            disabled={dropSubject.isPending}
          />
          <FieldDescription>
            Required, 1-500 characters. {reason.length}/500
          </FieldDescription>
        </Field>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={dropSubject.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={reasonInvalid || dropSubject.isPending}
            onClick={() => void submit()}
          >
            {dropSubject.isPending ? "Dropping..." : "Drop entire row"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
