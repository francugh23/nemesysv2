"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  useEnrollmentFormOptions,
  useUpdateEnrollment,
} from "@/hooks/enrollment.hook";
import { formatFullName } from "@/lib/format";
import {
  type EnrollmentListItem,
  type UpdateEnrollmentInput,
  UpdateEnrollmentSchema,
} from "@/schemas";

interface EditEnrollmentFormProps {
  enrollment: EnrollmentListItem;
  onSuccess?: () => void;
}

export function EditEnrollmentForm({
  enrollment,
  onSuccess,
}: EditEnrollmentFormProps) {
  const updateEnrollment = useUpdateEnrollment();
  const { data: options, isLoading } = useEnrollmentFormOptions();
  const form = useForm<UpdateEnrollmentInput>({
    resolver: zodResolver(UpdateEnrollmentSchema),
    defaultValues: {
      sectionId: enrollment.sectionId,
      semester: enrollment.semester ?? undefined,
      status: enrollment.status,
    },
  });
  const activeSectionOptions: SearchableSelectOption[] =
    options?.sections.map((section) => ({
      value: section.id,
      label: `Grade ${section.gradeLevel}${section.trackStrand ? ` - ${section.trackStrand}` : ""} - ${section.sectionName}`,
      searchValue: `${section.gradeLevel} ${section.trackStrand ?? ""} ${section.sectionName}`,
    })) ?? [];
  const currentSectionOption: SearchableSelectOption = {
    value: enrollment.sectionId,
    label: `Grade ${enrollment.sectionGradeLevel}${enrollment.sectionTrackStrand ? ` - ${enrollment.sectionTrackStrand}` : ""} - ${enrollment.sectionName}`,
    searchValue: `${enrollment.sectionGradeLevel} ${enrollment.sectionTrackStrand ?? ""} ${enrollment.sectionName}`,
  };
  const sectionOptions = activeSectionOptions.some(
    (section) => section.value === enrollment.sectionId,
  )
    ? activeSectionOptions
    : [currentSectionOption, ...activeSectionOptions];
  const studentName = formatFullName(
    enrollment.studentFirstName,
    enrollment.studentMiddleName,
    enrollment.studentLastName,
  );

  async function onSubmit(values: UpdateEnrollmentInput) {
    const result = await updateEnrollment.mutateAsync({
      id: enrollment.id,
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
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="font-medium">{studentName}</p>
        <p className="text-sm text-muted-foreground">
          {enrollment.studentLrn} · {enrollment.academicYear}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  isLoading
                    ? "Loading sections..."
                    : "Search any active section"
                }
                disabled={isLoading}
              />
            )}
          />
          <FieldError>{form.formState.errors.sectionId?.message}</FieldError>
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

        <Field>
          <FieldLabel>Enrollment Status</FieldLabel>
          <Controller
            name="status"
            control={form.control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="DROPPED">Dropped</SelectItem>
                  <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          <FieldError>{form.formState.errors.status?.message}</FieldError>
        </Field>
      </div>

      <Button type="submit" disabled={updateEnrollment.isPending}>
        {updateEnrollment.isPending ? "Saving..." : "Update Enrollment"}
      </Button>
    </form>
  );
}
