"use client";

import { Controller, type UseFormReturn } from "react-hook-form";

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
import { useEnrollmentFormOptions } from "@/hooks/enrollment.hook";
import type { CreateEnrollmentInput } from "@/schemas";

interface EnrollmentFormProps {
  form: UseFormReturn<CreateEnrollmentInput>;
}

function getStudentName(student: {
  firstName: string;
  middleName: string | null;
  lastName: string;
}) {
  return [student.lastName, student.firstName, student.middleName]
    .filter(Boolean)
    .join(", ");
}

export function EnrollmentForm({ form }: EnrollmentFormProps) {
  const { data: options, isLoading } = useEnrollmentFormOptions();
  const studentOptions: SearchableSelectOption[] =
    options?.students.map((student) => ({
      value: student.id,
      label: `${student.lrn} - ${getStudentName(student)}`,
      searchValue: `${student.lrn} ${student.firstName} ${student.middleName ?? ""} ${student.lastName}`,
    })) ?? [];
  const sectionOptions: SearchableSelectOption[] =
    options?.sections.map((section) => ({
      value: section.id,
      label: `Grade ${section.gradeLevel}${section.trackStrand ? ` - ${section.trackStrand}` : ""} - ${section.sectionName}`,
      searchValue: `${section.gradeLevel} ${section.trackStrand ?? ""} ${section.sectionName}`,
    })) ?? [];
  const academicYearOptions: SearchableSelectOption[] =
    options?.academicYears.map((academicYear) => ({
      value: academicYear.id,
      label: academicYear.label,
    })) ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel>Student</FieldLabel>
        <Controller
          name="studentId"
          control={form.control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onValueChange={field.onChange}
              options={studentOptions}
              placeholder={isLoading ? "Loading students..." : "Search students"}
              disabled={isLoading}
            />
          )}
        />
        <FieldError>{form.formState.errors.studentId?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Section</FieldLabel>
        <Controller
          name="sectionId"
          control={form.control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onValueChange={field.onChange}
              options={sectionOptions}
              placeholder={isLoading ? "Loading sections..." : "Search sections"}
              disabled={isLoading}
            />
          )}
        />
        <FieldError>{form.formState.errors.sectionId?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Academic Year</FieldLabel>
        <Controller
          name="academicYearId"
          control={form.control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onValueChange={field.onChange}
              options={academicYearOptions}
              placeholder={
                isLoading ? "Loading academic years..." : "Select academic year"
              }
              disabled={isLoading}
            />
          )}
        />
        <FieldError>{form.formState.errors.academicYearId?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Semester (optional)</FieldLabel>
        <Controller
          name="semester"
          control={form.control}
          render={({ field }) => (
            <Select
              value={field.value ?? "NONE"}
              onValueChange={(value) =>
                field.onChange(value === "NONE" ? undefined : value)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">No semester</SelectItem>
                <SelectItem value="FIRST">First semester</SelectItem>
                <SelectItem value="SECOND">Second semester</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        <FieldError>{form.formState.errors.semester?.message}</FieldError>
      </Field>
    </div>
  );
}
