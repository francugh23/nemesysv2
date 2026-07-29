"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSectionFormOptions } from "@/hooks/section.hook";
import { CreateSectionSchema, SECTION_GRADE_LEVELS } from "@/schemas";

type SectionFormValues = z.infer<typeof CreateSectionSchema>;

interface SectionFormProps {
  form: UseFormReturn<SectionFormValues>;
}

function getTeacherLabel(teacher: {
  employeeNumber: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
}) {
  const fullName = [teacher.lastName, teacher.firstName, teacher.middleName]
    .filter(Boolean)
    .join(", ");

  return teacher.employeeNumber
    ? `${teacher.employeeNumber} - ${fullName}`
    : fullName;
}

export function SectionForm({ form }: SectionFormProps) {
  const { data: options, isLoading } = useSectionFormOptions();
  const teacherOptions: SearchableSelectOption[] =
    options?.teachers.map((teacher) => ({
      value: teacher.id,
      label: getTeacherLabel(teacher),
      searchValue: `${teacher.employeeNumber ?? ""} ${teacher.firstName} ${teacher.middleName ?? ""} ${teacher.lastName}`,
    })) ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel>Grade Level</FieldLabel>
        <Controller
          name="gradeLevel"
          control={form.control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select grade level" />
              </SelectTrigger>
              <SelectContent>
                {SECTION_GRADE_LEVELS.map((gradeLevel) => (
                  <SelectItem key={gradeLevel} value={gradeLevel}>
                    Grade {gradeLevel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError>{form.formState.errors.gradeLevel?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Track / Strand</FieldLabel>
        <Input
          placeholder="Leave blank for JHS or shared SHS sections"
          {...form.register("trackStrand")}
        />
        <FieldError>{form.formState.errors.trackStrand?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Section Name</FieldLabel>
        <Input {...form.register("sectionName")} />
        <FieldError>{form.formState.errors.sectionName?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Adviser (optional)</FieldLabel>
        <Controller
          name="adviserId"
          control={form.control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onValueChange={field.onChange}
              options={teacherOptions}
              placeholder={isLoading ? "Loading teachers..." : "Search teachers"}
              disabled={isLoading}
            />
          )}
        />
        <FieldError>{form.formState.errors.adviserId?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Room (optional)</FieldLabel>
        <Input {...form.register("room")} />
        <FieldError>{form.formState.errors.room?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Shift (optional)</FieldLabel>
        <Controller
          name="shift"
          control={form.control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MORNING">Morning</SelectItem>
                <SelectItem value="AFTERNOON">Afternoon</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <FieldError>{form.formState.errors.shift?.message}</FieldError>
      </Field>
    </div>
  );
}
