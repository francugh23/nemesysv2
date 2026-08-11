"use client";

import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";

import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateSubjectSchema } from "@/schemas";

type SubjectFormValues = z.infer<typeof CreateSubjectSchema>;

interface SubjectFormProps {
  form: UseFormReturn<SubjectFormValues>;
}

export function SubjectForm({ form }: SubjectFormProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel>Subject Code</FieldLabel>
          <Input {...form.register("code")} />
        <FieldError>{form.formState.errors.code?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Grade Level</FieldLabel>
        <Select
          value={form.watch("gradeLevel") || undefined}
          onValueChange={(value) =>
            form.setValue("gradeLevel", value as "7" | "8" | "9" | "10" | "11" | "12", {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select grade level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Grade 7</SelectItem>
            <SelectItem value="8">Grade 8</SelectItem>
            <SelectItem value="9">Grade 9</SelectItem>
            <SelectItem value="10">Grade 10</SelectItem>
            <SelectItem value="11">Grade 11</SelectItem>
            <SelectItem value="12">Grade 12</SelectItem>
          </SelectContent>
        </Select>
        <FieldError>{form.formState.errors.gradeLevel?.message}</FieldError>
      </Field>

      <Field className="md:col-span-2">
        <FieldLabel>Description</FieldLabel>
        <Input {...form.register("description")} />
        <FieldError>{form.formState.errors.description?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Track / Strand</FieldLabel>
        <Input
          placeholder="Leave blank for JHS or shared SHS subjects"
          {...form.register("trackStrand")}
        />
        <FieldError>{form.formState.errors.trackStrand?.message}</FieldError>
      </Field>

    </div>
  );
}
