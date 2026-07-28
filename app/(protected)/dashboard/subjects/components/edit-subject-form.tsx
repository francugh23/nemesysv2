"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { updateSubjectAction } from "@/actions/subject.action";
import { Button } from "@/components/ui/button";
import { UpdateSubjectSchema } from "@/schemas";
import type { SubjectGradeLevel } from "@/lib/subject-identity";
import type { SubjectListItem } from "@/schemas";

import { SubjectForm } from "./subject-form";

interface EditSubjectFormProps {
  subject: SubjectListItem;
  onSuccess?: () => void;
}

export function EditSubjectForm({ subject, onSuccess }: EditSubjectFormProps) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof UpdateSubjectSchema>>({
    resolver: zodResolver(UpdateSubjectSchema),
    defaultValues: {
      code: subject.code,
      description: subject.description,
      gradeLevel: subject.gradeLevel as SubjectGradeLevel,
      trackStrand: subject.trackStrand ?? "",
      semester: subject.semester ?? undefined,
    },
  });

  function onSubmit(values: z.infer<typeof UpdateSubjectSchema>) {
    startTransition(async () => {
      const result = await updateSubjectAction(subject.id, values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      await queryClient.invalidateQueries({
        queryKey: ["subjects"],
      });
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <SubjectForm form={form} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Update Subject"}
      </Button>
    </form>
  );
}
