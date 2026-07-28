"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { z } from "zod";

import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
import { useSubjectAssignmentOptions } from "@/hooks/subject-assignment.hook";
import { CreateSubjectAssignmentSchema } from "@/schemas";

type SubjectAssignmentFormValues = z.infer<
  typeof CreateSubjectAssignmentSchema
>;

interface SubjectAssignmentFormProps {
  form: UseFormReturn<SubjectAssignmentFormValues>;
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

export function SubjectAssignmentForm({ form }: SubjectAssignmentFormProps) {
  const { data: options, isLoading } = useSubjectAssignmentOptions();
  const teacherOptions: SearchableSelectOption[] =
    options?.teachers.map((teacher) => ({
      value: teacher.id,
      label: getTeacherLabel(teacher),
      searchValue: `${teacher.employeeNumber ?? ""} ${teacher.firstName} ${teacher.middleName ?? ""} ${teacher.lastName}`,
    })) ?? [];
  const subjectOptions: SearchableSelectOption[] =
    options?.subjects.map((subject) => ({
      value: subject.id,
      label: `${subject.code} - ${subject.description}`,
      searchValue: `${subject.gradeLevel} ${subject.trackStrand ?? ""}`,
    })) ?? [];
  const sectionOptions: SearchableSelectOption[] =
    options?.sections.map((section) => ({
      value: section.id,
      label: `Grade ${section.gradeLevel}${section.trackStrand ? ` - ${section.trackStrand}` : ""} - ${section.sectionName}`,
      searchValue: `${section.gradeLevel} ${section.trackStrand ?? ""} ${section.sectionName}`,
    })) ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel>Teacher</FieldLabel>
        <Controller
          name="teacherId"
          control={form.control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onValueChange={field.onChange}
              options={teacherOptions}
              placeholder={
                isLoading ? "Loading teachers..." : "Search teachers"
              }
              disabled={isLoading}
            />
          )}
        />
        <FieldError>{form.formState.errors.teacherId?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Subject</FieldLabel>
        <Controller
          name="subjectId"
          control={form.control}
          render={({ field }) => (
            <SearchableSelect
              value={field.value}
              onValueChange={field.onChange}
              options={subjectOptions}
              placeholder={
                isLoading ? "Loading subjects..." : "Search subjects"
              }
              disabled={isLoading}
            />
          )}
        />
        <FieldError>{form.formState.errors.subjectId?.message}</FieldError>
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
              placeholder={
                isLoading ? "Loading sections..." : "Search sections"
              }
              disabled={isLoading}
            />
          )}
        />
        <FieldError>{form.formState.errors.sectionId?.message}</FieldError>
      </Field>

      <Field>
        <FieldLabel>Academic Year</FieldLabel>
        <Input placeholder="e.g. 2026-2027" {...form.register("academicYear")} />
        <FieldError>{form.formState.errors.academicYear?.message}</FieldError>
      </Field>
    </div>
  );
}
