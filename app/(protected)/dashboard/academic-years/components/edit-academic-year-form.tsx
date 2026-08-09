"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useUpdateAcademicYear } from "@/hooks/academic-year.hook";
import {
  UpdateAcademicYearSchema,
  type AcademicYearListItem,
  type UpdateAcademicYearInput,
} from "@/schemas";

import { AcademicYearForm } from "./academic-year-form";

export function EditAcademicYearForm({
  academicYear,
  onSuccess,
}: {
  academicYear: AcademicYearListItem;
  onSuccess?: () => void;
}) {
  const updateAcademicYear = useUpdateAcademicYear();
  const form = useForm<UpdateAcademicYearInput>({
    resolver: zodResolver(UpdateAcademicYearSchema),
    defaultValues: {
      startDate: new Date(academicYear.startDate).toISOString().slice(0, 10),
      endDate: new Date(academicYear.endDate).toISOString().slice(0, 10),
    },
  });

  async function onSubmit(values: UpdateAcademicYearInput) {
    const result = await updateAcademicYear.mutateAsync({
      id: academicYear.id,
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
      <AcademicYearForm form={form} />
      <div className="flex justify-end">
        <Button type="submit" disabled={updateAcademicYear.isPending}>
          {updateAcademicYear.isPending ? "Saving..." : "Update Academic Year"}
        </Button>
      </div>
    </form>
  );
}
