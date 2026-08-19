"use client";

import { Controller, type UseFormReturn, useWatch } from "react-hook-form";
import { z } from "zod";

import { Checkbox } from "@/components/ui/checkbox";
import { AcademicTermBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
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
import { useSubjectOfferingOptions } from "@/hooks/subject-offering.hook";
import { CreateSubjectOfferingSchema } from "@/schemas";

type SubjectOfferingFormValues = z.infer<typeof CreateSubjectOfferingSchema>;

interface SubjectOfferingFormProps {
  form: UseFormReturn<SubjectOfferingFormValues>;
}

export function SubjectOfferingForm({ form }: SubjectOfferingFormProps) {
  const { data: options, isLoading } = useSubjectOfferingOptions();
  const gradeLevel = useWatch({ control: form.control, name: "gradeLevel" });
  const classification = useWatch({ control: form.control, name: "shsContext.classification" });
  const academicYearId = useWatch({ control: form.control, name: "academicYearId" });
  const academicYear = options?.academicYears.find(
    (year) => year.id === academicYearId,
  );
  const isJhs = ["7", "8", "9", "10"].includes(gradeLevel ?? "");
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
      <div className="md:col-span-2">
        <p className="font-medium">Subject Offering configuration</p>
        <p className="text-sm text-muted-foreground">
          Choose the Academic Year and Grade, then connect a reusable Subject to its exact Curriculum context and Terms.
        </p>
      </div>
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
                const selectedYear = options?.academicYears.find((year) => year.id === value);
                form.setValue(
                  "academicTermIds",
                  isJhs ? selectedYear?.terms.map((term) => term.id) ?? [] : [],
                );
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
                if (value && ["7", "8", "9", "10"].includes(value)) {
                  form.setValue("shsContext", undefined);
                  form.setValue(
                    "academicTermIds",
                    academicYear?.terms.map((term) => term.id) ?? [],
                  );
                } else if (value) {
                  if (!form.getValues("shsContext")) {
                    form.setValue("shsContext", {
                      classification: "CORE",
                      curriculumStatus: "PROVISIONAL_DEPED",
                      sourceReference: "",
                    });
                  }
                  form.setValue("academicTermIds", []);
                }
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
              placeholder={
                isLoading
                  ? "Loading subjects..."
                  : gradeLevel
                    ? "Search reusable Subject definitions"
                    : "Select a grade level first"
              }
              disabled={isLoading || !gradeLevel}
            />
          )}
        />
        <FieldError>{form.formState.errors.subjectId?.message}</FieldError>
        <p className="text-xs text-muted-foreground">
          The Subject is the reusable definition. This Subject Offering is its Academic-Year-specific Curriculum record.
        </p>
      </Field>

      {["11", "12"].includes(gradeLevel ?? "") && (
        <div className="grid gap-4 rounded-lg border p-4 md:col-span-2 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="font-medium">SHS Curriculum Context</p>
            <p className="text-sm text-muted-foreground">Classify this specific Offering as Core, Academic Elective, or TechPro Elective. Classification does not belong to the reusable Subject.</p>
          </div>
          <Field>
            <FieldLabel>Classification</FieldLabel>
            <Controller
              name="shsContext.classification"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={(value) => {
                  field.onChange(value);
                  if (value === "CORE") form.setValue("shsContext.clusterId", undefined);
                }}>
                  <SelectTrigger><SelectValue placeholder="Select classification" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CORE">Core Subject</SelectItem>
                    <SelectItem value="ACADEMIC_ELECTIVE">Academic Elective</SelectItem>
                    <SelectItem value="TECHPRO_ELECTIVE">TechPro Elective</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError>{form.formState.errors.shsContext?.classification?.message}</FieldError>
          </Field>
          {classification !== "CORE" && (
            <Field>
              <FieldLabel>School-Facing Cluster</FieldLabel>
              <Controller
                name="shsContext.clusterId"
                control={form.control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    options={(options?.shsClusters ?? [])
                      .filter((cluster) => classification === "ACADEMIC_ELECTIVE" ? cluster.track === "ACADEMIC" : cluster.track === "TECHPRO")
                      .map((cluster) => ({ value: cluster.id, label: cluster.name, searchValue: `${cluster.code} ${cluster.name}` }))}
                    placeholder="Select active cluster"
                    disabled={isLoading}
                  />
                )}
              />
              <FieldError>{form.formState.errors.shsContext?.clusterId?.message}</FieldError>
            </Field>
          )}
          <Field className={classification === "CORE" ? "md:col-span-2" : undefined}>
            <FieldLabel>Source / Provenance Reference</FieldLabel>
            <Controller name="shsContext.sourceReference" control={form.control} render={({ field }) => <Input {...field} value={field.value ?? ""} placeholder="Document, policy, or source supporting this configuration" />} />
            <FieldError>{form.formState.errors.shsContext?.sourceReference?.message}</FieldError>
            <p className="text-xs text-muted-foreground">
              New SHS Offerings require the separate school-approval action before student use.
            </p>
          </Field>
        </div>
      )}

      <Field className="md:col-span-2">
        <FieldLabel>Academic Terms</FieldLabel>
        <Controller
          name="academicTermIds"
          control={form.control}
          render={({ field }) => (
            <div className="grid gap-2 sm:grid-cols-3">
              {!gradeLevel ? (
                <p className="text-sm text-muted-foreground">
                  Select a grade level before configuring Term applicability.
                </p>
              ) : academicYear && isJhs ? (
                <div className="space-y-3 rounded-lg border bg-muted/30 p-4 sm:col-span-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Full Academic Year</Badge>
                    <span className="text-sm text-muted-foreground">
                      JHS uses every configured Term; partial-Term configuration is not available.
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {academicYear.terms.map((term) => (
                      <AcademicTermBadge key={term.id} position={term.position} name={term.name} />
                    ))}
                  </div>
                </div>
              ) : academicYear ? (
                academicYear.terms.map((term) => {
                  const checked = field.value.includes(term.id);
                  const termLabel = `Term ${term.position}`;
                  const configuredName = term.name.trim();
                  const showConfiguredName =
                    configuredName.toLocaleLowerCase() !== termLabel.toLocaleLowerCase();

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
                      <span className="flex flex-col items-start gap-0.5">
                        <AcademicTermBadge position={term.position} name={term.name} />
                        {showConfiguredName && (
                          <span className="text-xs text-muted-foreground">{configuredName}</span>
                        )}
                      </span>
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
        {["11", "12"].includes(gradeLevel ?? "") && (
          <p className="text-xs text-muted-foreground">
            Select the exact Terms for this SHS Offering. No all-Term or Grade 12 TechPro placement is inferred.
          </p>
        )}
      </Field>
    </div>
  );
}
