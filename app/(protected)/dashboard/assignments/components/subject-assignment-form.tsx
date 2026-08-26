"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { useSubjectAssignmentOptions } from "@/hooks/subject-assignment.hook";
import { CreateSubjectAssignmentSchema } from "@/schemas";

type Values = z.infer<typeof CreateSubjectAssignmentSchema>;
export function SubjectAssignmentForm({ form }: { form: UseFormReturn<Values> }) {
  const { data: options, isLoading } = useSubjectAssignmentOptions();
  const [academicYearId, setAcademicYearId] = useState("");
  const teachers: SearchableSelectOption[] = options?.teachers.map((teacher) => ({ value: teacher.id, label: `${teacher.employeeNumber ?? ""} - ${teacher.lastName}, ${teacher.firstName}`, searchValue: `${teacher.employeeNumber ?? ""} ${teacher.lastName} ${teacher.firstName}` })) ?? [];
  const sections: SearchableSelectOption[] = options?.sections.map((section) => ({ value: section.id, label: `Grade ${section.gradeLevel} - ${section.sectionName}`, searchValue: `${section.gradeLevel} ${section.sectionName}` })) ?? [];
  const scopes: SearchableSelectOption[] = options?.scopes.filter((scope) => !academicYearId || scope.academicYearId === academicYearId).map((scope) => ({ value: `${scope.subjectOfferingId}:${scope.academicTermId}`, label: `Grade ${scope.gradeLevel} | ${scope.subjectCode} - ${scope.subjectDescription} | ${scope.academicTermName}`, searchValue: `${scope.gradeLevel} ${scope.subjectCode} ${scope.subjectDescription} ${scope.academicTermName}` })) ?? [];
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
    <Field><FieldLabel>Academic Year</FieldLabel><SearchableSelect value={academicYearId} onValueChange={setAcademicYearId} options={options?.academicYears.map((year) => ({ value: year.id, label: year.label })) ?? []} placeholder="Select Academic Year" disabled={isLoading} /></Field>
    <Field><FieldLabel>Section</FieldLabel><Controller name="sectionId" control={form.control} render={({ field }) => <SearchableSelect value={field.value} onValueChange={field.onChange} options={sections} placeholder="Select Section" disabled={isLoading} />} /><FieldError>{form.formState.errors.sectionId?.message}</FieldError></Field>
    <Field><FieldLabel>Curriculum Offering Term</FieldLabel><Controller name="subjectOfferingId" control={form.control} render={({ field }) => <SearchableSelect value={field.value && form.getValues("academicTermId") ? `${field.value}:${form.getValues("academicTermId")}` : ""} onValueChange={(value) => { const [subjectOfferingId, academicTermId] = value.split(":"); field.onChange(subjectOfferingId); form.setValue("academicTermId", academicTermId, { shouldValidate: true }); }} options={scopes} placeholder="Select Curriculum Offering Term" disabled={isLoading || !academicYearId} />} /><FieldError>{form.formState.errors.subjectOfferingId?.message ?? form.formState.errors.academicTermId?.message}</FieldError></Field>
    <Field><FieldLabel>Teacher</FieldLabel><Controller name="teacherId" control={form.control} render={({ field }) => <SearchableSelect value={field.value} onValueChange={field.onChange} options={teachers} placeholder="Search teachers" disabled={isLoading} />} /><FieldError>{form.formState.errors.teacherId?.message}</FieldError></Field>
  </div>;
}
