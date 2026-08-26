"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useUpdateSubjectAssignment } from "@/hooks/subject-assignment.hook";
import {
  type SubjectAssignmentListItem,
  UpdateSubjectAssignmentSchema,
} from "@/schemas";

import { SubjectAssignmentForm } from "./subject-assignment-form";

interface EditSubjectAssignmentFormProps {
  assignment: SubjectAssignmentListItem;
  onSuccess?: () => void;
}

type UpdateSubjectAssignmentValues = z.infer<
  typeof UpdateSubjectAssignmentSchema
>;

export function EditSubjectAssignmentForm({
  assignment,
  onSuccess,
}: EditSubjectAssignmentFormProps) {
  const updateAssignment = useUpdateSubjectAssignment();
  const form = useForm<UpdateSubjectAssignmentValues>({
    resolver: zodResolver(UpdateSubjectAssignmentSchema),
    defaultValues: {
      teacherId: assignment.teacherId,
      subjectOfferingId: assignment.subjectOfferingId,
      academicTermId: assignment.academicTermId,
      sectionId: assignment.sectionId,
    },
  });

  async function onSubmit(values: UpdateSubjectAssignmentValues) {
    const result = await updateAssignment.mutateAsync({
      id: assignment.id,
      values,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    onSuccess?.();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <SubjectAssignmentForm form={form} />
      <Button type="submit" disabled={updateAssignment.isPending}>
        {updateAssignment.isPending ? "Saving..." : "Update Assignment"}
      </Button>
    </form>
  );
}
