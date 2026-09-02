"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createSubjectAssignmentAction } from "@/actions/subject-assignment.action";
import { Button } from "@/components/ui/button";
import { CreateSubjectAssignmentSchema } from "@/schemas";

import { SubjectAssignmentForm } from "./subject-assignment-form";

interface CreateSubjectAssignmentFormProps {
  onSuccess?: () => void;
}

export function CreateSubjectAssignmentForm({
  onSuccess,
}: CreateSubjectAssignmentFormProps) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof CreateSubjectAssignmentSchema>>({
    resolver: zodResolver(CreateSubjectAssignmentSchema),
    defaultValues: {
      teacherId: "",
      subjectOfferingId: "",
      academicTermId: "",
      sectionId: "",
    },
  });

  function onSubmit(values: z.infer<typeof CreateSubjectAssignmentSchema>) {
    startTransition(async () => {
      const result = await createSubjectAssignmentAction(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      await queryClient.invalidateQueries({
        queryKey: ["subject-assignments"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["assignment-matrix"],
      });
      form.reset();
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <SubjectAssignmentForm form={form} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Assignment"}
      </Button>
    </form>
  );
}
