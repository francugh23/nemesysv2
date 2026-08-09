"use client";

import { useWatch, type UseFormReturn } from "react-hook-form";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { CreateAcademicYearInput } from "@/schemas";

interface AcademicYearFormProps {
  form: UseFormReturn<CreateAcademicYearInput>;
}

export function AcademicYearForm({ form }: AcademicYearFormProps) {
  const [startDate, endDate] = useWatch({
    control: form.control,
    name: ["startDate", "endDate"],
  });
  const startYear = /^\d{4}-/.test(startDate) ? startDate.slice(0, 4) : null;
  const endYear = /^\d{4}-/.test(endDate) ? endDate.slice(0, 4) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="academic-year-start-date">Start Date</FieldLabel>
          <Input
            id="academic-year-start-date"
            type="date"
            {...form.register("startDate")}
          />
          <FieldError>{form.formState.errors.startDate?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel htmlFor="academic-year-end-date">End Date</FieldLabel>
          <Input
            id="academic-year-end-date"
            type="date"
            {...form.register("endDate")}
          />
          <FieldError>{form.formState.errors.endDate?.message}</FieldError>
        </Field>
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-sm text-muted-foreground">Academic year preview</p>
        <p className="text-lg font-semibold">
          {startYear && endYear ? `${startYear}-${endYear}` : "YYYY-YYYY"}
        </p>
      </div>
    </div>
  );
}
