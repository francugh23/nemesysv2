"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useCreateSubject } from "@/hooks/subject.hook";
import { CreateSubjectSchema } from "@/schemas";

import { SubjectForm } from "./subject-form";

interface CreateSubjectFormProps {
  onSuccess?: () => void;
}

export function CreateSubjectForm({ onSuccess }: CreateSubjectFormProps) {
  const createSubject = useCreateSubject();
  const form = useForm<z.infer<typeof CreateSubjectSchema>>({
    resolver: zodResolver(CreateSubjectSchema),
    defaultValues: {
      code: "",
      description: "",
      gradeLevel: undefined,
    },
  });

  async function onSubmit(values: z.infer<typeof CreateSubjectSchema>) {
    const result = await createSubject.mutateAsync(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    form.reset();
    onSuccess?.();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <SubjectForm form={form} />
      <Button type="submit" disabled={createSubject.isPending}>
        {createSubject.isPending ? "Creating..." : "Create Subject"}
      </Button>
    </form>
  );
}
