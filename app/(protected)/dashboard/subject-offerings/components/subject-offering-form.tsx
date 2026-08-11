"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
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
import { useSubjectOfferingOptions } from "@/hooks/subject-offering.hook";
import { CreateSubjectOfferingSchema } from "@/schemas";

type SubjectOfferingFormValues = z.infer<typeof CreateSubjectOfferingSchema>;

interface SubjectOfferingFormProps {
  form: UseFormReturn<SubjectOfferingFormValues>;
}

export function SubjectOfferingForm({ form }: SubjectOfferingFormProps) {
  const { data: options, isLoading } = useSubjectOfferingOptions();
  const gradeLevel = form.watch("gradeLevel");
  const academicYearId = form.watch("academicYearId");
  const academicYear = options?.academicYears.find(
    (year) => year.id === academicYearId,
  );
  const academicYearOptions: SearchableSelectOption[] =
    options?.academicYears.map((year) => ({
      value: year.id,
      label: year.label,
    })) ?? [];
  const subjectOptions: SearchableSelectOption[] =
    options?.subjects
      .filter((subject) => !gradeLevel || subject.gradeLevel === gradeLevel)
      .map((subject) => ({
        value: subject.id,
        label: `${subject.code} - ${subject.description}`,
        searchValue: `${subject.code} ${subject.description} Grade ${subject.gradeLevel}`,
      })) ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel>Academic Year</FieldLabel>
        <Controller
          name="academicYearId"
          control={form.control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);
                form.setValue("academicTermIds", []);
              }}
              options={academicYearOptions}
              placeholder={isLoading ? "Loading academic years..." : "Select academic year"}
              disabled={isLoading}
            />
          )}
        />
        <FieldError>{form.formState.errors.academicYearId?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Grade Level</FieldLabel>
        <Controller
          name="gradeLevel"
          control={form.control}
          render={({ field }) => (
            <Select
              value={field.value || null}
              onValueChange={(value) => {
                field.onChange(value);
                form.setValue("subjectId", "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select grade level" />
              </SelectTrigger>
              <SelectContent>
                {["7", "8", "9", "10", "11", "12"].map((grade) => (
                  <SelectItem key={grade} value={grade}>
                    Grade {grade}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError>{form.formState.errors.gradeLevel?.message}</FieldError>
      </Field>

      <Field className="md:col-span-2">
        <FieldLabel>Subject</FieldLabel>
        <Controller
          name="subjectId"
          control={form.control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onValueChange={(value) => {
                field.onChange(value);

                const subject = options?.subjects.find((item) => item.id === value);
                if (subject && !gradeLevel) {
                  form.setValue("gradeLevel", subject.gradeLevel as SubjectOfferingFormValues["gradeLevel"]);
                }
              }}
              options={subjectOptions}
              placeholder={isLoading ? "Loading subjects..." : "Search subjects"}
              disabled={isLoading}
            />
          )}
        />
        <FieldError>{form.formState.errors.subjectId?.message}</FieldError>
      </Field>

      <Field className="md:col-span-2">
        <FieldLabel>Academic Terms</FieldLabel>
        <Controller
          name="academicTermIds"
          control={form.control}
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-3">
              {academicYear ? (
                academicYear.terms.map((term) => {
                  const checked = field.value.includes(term.id);

                  return (
                    <label
                      key={term.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          field.onChange(
                            checked
                              ? field.value.filter((id) => id !== term.id)
                              : [...field.value, term.id],
                          )
                        }
                      />
                      {term.name}
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select an academic year to choose its terms.
                </p>
              )}
            </div>
          )}
        />
        <FieldError>{form.formState.errors.academicTermIds?.message}</FieldError>
      </Field>
    </div>
  );
}
