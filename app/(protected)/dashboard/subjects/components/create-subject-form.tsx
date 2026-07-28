"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createSubjectAction } from "@/actions/subject.action";
import { Button } from "@/components/ui/button";
import { CreateSubjectSchema } from "@/schemas";

import { SubjectForm } from "./subject-form";

interface CreateSubjectFormProps {
  onSuccess?: () => void;
}

export function CreateSubjectForm({ onSuccess }: CreateSubjectFormProps) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof CreateSubjectSchema>>({
    resolver: zodResolver(CreateSubjectSchema),
    defaultValues: {
      code: "",
      description: "",
      gradeLevel: undefined,
      trackStrand: "",
      semester: undefined,
    },
  });

  function onSubmit(values: z.infer<typeof CreateSubjectSchema>) {
    startTransition(async () => {
      const result = await createSubjectAction(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      await queryClient.invalidateQueries({
        queryKey: ["subjects"],
      });
      form.reset();
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <SubjectForm form={form} />
      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Subject"}
      </Button>
    </form>
  );
}
