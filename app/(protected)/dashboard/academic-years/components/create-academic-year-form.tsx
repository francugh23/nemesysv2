"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCreateAcademicYear } from "@/hooks/academic-year.hook";
import {
  CreateAcademicYearSchema,
  type CreateAcademicYearInput,
} from "@/schemas";

import { AcademicYearForm } from "./academic-year-form";

export function CreateAcademicYearForm({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const createAcademicYear = useCreateAcademicYear();
  const form = useForm<CreateAcademicYearInput>({
    resolver: zodResolver(CreateAcademicYearSchema),
    defaultValues: { startDate: "", endDate: "" },
  });

  async function onSubmit(values: CreateAcademicYearInput) {
    const result = await createAcademicYear.mutateAsync(values);

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
      <AcademicYearForm form={form} />
      <div className="flex justify-end">
        <Button type="submit" disabled={createAcademicYear.isPending}>
          {createAcademicYear.isPending ? "Creating..." : "Create Academic Year"}
        </Button>
      </div>
    </form>
  );
}
