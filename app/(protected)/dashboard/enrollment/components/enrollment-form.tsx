"use client";

import { useEffect, useRef } from "react";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select";
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
  const selectedAcademicYearId = useWatch({
    control: form.control,
    name: "academicYearId",
  });
  const selectedSectionId = useWatch({
    control: form.control,
    name: "sectionId",
  });
  const previousAcademicYearId = useRef(selectedAcademicYearId);
  const selectedAcademicYear = options?.academicYears.find(
    ({ id }) => id === selectedAcademicYearId,
  );
  const selectedSection = options?.sections.find(
    ({ id }) => id === selectedSectionId,
  );
  const isShs =
    selectedSection?.gradeLevel === "11" ||
    selectedSection?.gradeLevel === "12";

  useEffect(() => {
    if (previousAcademicYearId.current !== selectedAcademicYearId) {
      form.setValue("entryAcademicTermId", "", {
        shouldDirty: true,
        shouldValidate: true,
      });
      previousAcademicYearId.current = selectedAcademicYearId;
    }
  }, [form, selectedAcademicYearId]);

  useEffect(() => {
    if (!isShs) {
      form.setValue("entryAcademicTermId", undefined, {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("shsTrack", undefined, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, isShs]);
  const studentOptions: SearchableSelectOption[] =
    options?.students.map((student) => ({
      value: student.id,
      label: `${student.lrn} - ${getStudentName(student)}`,
      searchValue: `${student.lrn} ${student.firstName} ${student.middleName ?? ""} ${student.lastName}`,
    })) ?? [];
  const sectionOptions: SearchableSelectOption[] =
    options?.sections.map((section) => ({
      value: section.id,
      label: `Grade ${section.gradeLevel} - ${section.sectionName}`,
      searchValue: `${section.gradeLevel} ${section.sectionName}`,
    })) ?? [];
  const academicYearOptions: SearchableSelectOption[] =
    options?.academicYears.map((academicYear) => ({
      value: academicYear.id,
      label: academicYear.label,
    })) ?? [];
  const academicTermOptions: SearchableSelectOption[] =
    selectedAcademicYear?.terms.map((term) => ({
      value: term.id,
      label: `Term ${term.position}`,
      searchValue: `${term.position} ${term.name}`,
    })) ?? [];
  const shsTrackOptions: SearchableSelectOption[] = [
    { value: "ACADEMIC", label: "Academic" },
    { value: "TECHPRO", label: "TechPro" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 overflow-hidden">
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

      {isShs && selectedAcademicYearId ? (
        <Field>
          <FieldLabel>Entry Academic Term</FieldLabel>
          <Controller
            name="entryAcademicTermId"
            control={form.control}
            render={({ field }) => (
              <SearchableSelect
                value={field.value}
                onValueChange={field.onChange}
                options={academicTermOptions}
                placeholder={
                  isLoading
                    ? "Loading Academic Terms..."
                    : "Select entry Academic Term"
                }
                disabled={isLoading || !academicTermOptions.length}
              />
            )}
          />
          <FieldError>
            {form.formState.errors.entryAcademicTermId?.message}
          </FieldError>
        </Field>
      ) : null}

      {isShs ? (
        <Field>
          <FieldLabel>SHS Track</FieldLabel>
          <Controller
            name="shsTrack"
            control={form.control}
            render={({ field }) => (
              <SearchableSelect
                value={field.value ?? ""}
                onValueChange={field.onChange}
                options={shsTrackOptions}
                placeholder="Select SHS Track"
                disabled={isLoading}
              />
            )}
          />
          <FieldError>{form.formState.errors.shsTrack?.message}</FieldError>
        </Field>
      ) : null}
    </div>
  );
}
