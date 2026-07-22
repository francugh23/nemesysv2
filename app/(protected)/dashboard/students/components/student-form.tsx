"use client";

import { toast } from "sonner";
import {
  createStudentAction,
  updateStudentAction,
} from "@/actions/student.action";

import { useQueryClient } from "@tanstack/react-query";
import { useTransition } from "react";
import { useForm } from "react-hook-form";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { CreateStudentSchema } from "@/schemas";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

import type { Student } from "@/app/generated/prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StudentFormProps {
  student?: Student;
  onSuccess?: () => void;
}

export function StudentForm({ student, onSuccess }: StudentFormProps) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof CreateStudentSchema>>({
    resolver: zodResolver(CreateStudentSchema),
    defaultValues: {
      lrn: student?.lrn ?? "",
      firstName: student?.firstName ?? "",
      middleName: student?.middleName ?? "",
      lastName: student?.lastName ?? "",
      gender: student?.gender ?? "MALE",
      dateOfBirth: student?.dateOfBirth ?? undefined,
      purok: student?.purok ?? "",
      barangay: student?.barangay ?? "",
      municipality: student?.municipality ?? "",
      province: student?.province ?? "",
      zipCode: student?.zipCode ?? "",
      fatherName: student?.fatherName ?? "",
      fatherContact: student?.fatherContact ?? "",
      motherName: student?.motherName ?? "",
      motherContact: student?.motherContact ?? "",
      guardianName: student?.guardianName ?? "",
      guardianContact: student?.guardianContact ?? "",
    },
  });

  function onSubmit(values: z.infer<typeof CreateStudentSchema>) {
    startTransition(async () => {
      const result = student
        ? await updateStudentAction(student.id, values)
        : await createStudentAction(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);

      await queryClient.invalidateQueries({
        queryKey: ["students"],
      });

      form.reset();
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Personal Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field>
            <FieldLabel>LRN</FieldLabel>
            <Input placeholder="12 digit LRN" {...form.register("lrn")} />
            <FieldError>{form.formState.errors.lrn?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel>Gender</FieldLabel>

            <Select
              defaultValue={student?.gender ?? "MALE"}
              onValueChange={(value) =>
                form.setValue("gender", value as "MALE" | "FEMALE", {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>

                <SelectItem value="FEMALE">Female</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>First Name</FieldLabel>
            <Input {...form.register("firstName")} />
            <FieldError>{form.formState.errors.firstName?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel>Middle Name</FieldLabel>
            <Input {...form.register("middleName")} />
          </Field>

          <Field>
            <FieldLabel>Last Name</FieldLabel>
            <Input {...form.register("lastName")} />
            <FieldError>{form.formState.errors.lastName?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel>Date of Birth</FieldLabel>
            <Input
              type="date"
              onChange={(e) =>
                form.setValue(
                  "dateOfBirth",
                  e.target.value ? new Date(e.target.value) : undefined,
                  {
                    shouldValidate: true,
                  },
                )
              }
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Address Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field>
            <FieldLabel>Purok</FieldLabel>
            <Input {...form.register("purok")} />
          </Field>

          <Field>
            <FieldLabel>Barangay</FieldLabel>
            <Input {...form.register("barangay")} />
            <FieldError>{form.formState.errors.barangay?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel>Municipality</FieldLabel>
            <Input {...form.register("municipality")} />
            <FieldError>
              {form.formState.errors.municipality?.message}
            </FieldError>
          </Field>

          <Field>
            <FieldLabel>Province</FieldLabel>
            <Input {...form.register("province")} />
            <FieldError>{form.formState.errors.province?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel>Zip Code</FieldLabel>
            <Input {...form.register("zipCode")} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Family Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field>
            <FieldLabel>Father Name</FieldLabel>
            <Input {...form.register("fatherName")} />
          </Field>

          <Field>
            <FieldLabel>Father Contact</FieldLabel>
            <Input {...form.register("fatherContact")} />
          </Field>

          <Field>
            <FieldLabel>Mother Name</FieldLabel>
            <Input {...form.register("motherName")} />
          </Field>

          <Field>
            <FieldLabel>Mother Contact</FieldLabel>
            <Input {...form.register("motherContact")} />
          </Field>

          <Field>
            <FieldLabel>Guardian Name</FieldLabel>
            <Input {...form.register("guardianName")} />
          </Field>

          <Field>
            <FieldLabel>Guardian Contact</FieldLabel>
            <Input {...form.register("guardianContact")} />
          </Field>
        </div>
      </section>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving..." : student ? "Update Student" : "Save Student"}
      </Button>
    </form>
  );
}