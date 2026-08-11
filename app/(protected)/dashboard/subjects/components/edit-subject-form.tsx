"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useUpdateSubject } from "@/hooks/subject.hook";
import { UpdateSubjectSchema } from "@/schemas";
import type { SubjectGradeLevel } from "@/lib/subject-identity";
import type { SubjectListItem } from "@/schemas";

import { SubjectForm } from "./subject-form";

interface EditSubjectFormProps {
  subject: SubjectListItem;
  onSuccess?: () => void;
}

export function EditSubjectForm({ subject, onSuccess }: EditSubjectFormProps) {
  const updateSubject = useUpdateSubject();
  const form = useForm<z.infer<typeof UpdateSubjectSchema>>({
    resolver: zodResolver(UpdateSubjectSchema),
    defaultValues: {
      code: subject.code,
      description: subject.description,
      gradeLevel: subject.gradeLevel as SubjectGradeLevel,
      trackStrand: subject.trackStrand ?? "",
    },
  });

  async function onSubmit(values: z.infer<typeof UpdateSubjectSchema>) {
    const result = await updateSubject.mutateAsync({ id: subject.id, values });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    onSuccess?.();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <SubjectForm form={form} />
      <Button type="submit" disabled={updateSubject.isPending}>
        {updateSubject.isPending ? "Saving..." : "Update Subject"}
      </Button>
    </form>
  );
}
