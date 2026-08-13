"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCreateEnrollment } from "@/hooks/enrollment.hook";
import {
  CreateEnrollmentSchema,
  type CreateEnrollmentInput,
} from "@/schemas";

import { EnrollmentForm } from "./enrollment-form";

interface CreateEnrollmentFormProps {
  onSuccess?: () => void;
}

export function CreateEnrollmentForm({
  onSuccess,
}: CreateEnrollmentFormProps) {
  const createEnrollment = useCreateEnrollment();
  const form = useForm<CreateEnrollmentInput>({
    resolver: zodResolver(CreateEnrollmentSchema),
    defaultValues: {
      studentId: "",
      sectionId: "",
      academicYearId: "",
      entryAcademicTermId: undefined,
      shsTrack: undefined,
    },
  });

  async function onSubmit(values: CreateEnrollmentInput) {
    const result = await createEnrollment.mutateAsync(values);

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
      <EnrollmentForm form={form} />
      <Button type="submit" disabled={createEnrollment.isPending}>
        {createEnrollment.isPending ? "Creating..." : "Create Enrollment"}
      </Button>
    </form>
  );
}
