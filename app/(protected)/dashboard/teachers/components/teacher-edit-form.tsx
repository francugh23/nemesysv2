"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useUpdateTeacher } from "@/hooks/teacher.hook";
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
import { UpdateTeacherSchema } from "@/schemas";
import type { TeacherListItem } from "@/schemas";

interface TeacherEditFormProps {
  teacher: TeacherListItem;
  onSuccess?: () => void;
}

export function TeacherEditForm({ teacher, onSuccess }: TeacherEditFormProps) {
  const updateTeacher = useUpdateTeacher();
  const form = useForm<z.infer<typeof UpdateTeacherSchema>>({
    resolver: zodResolver(UpdateTeacherSchema),
    defaultValues: {
      employeeNumber: teacher.employeeNumber,
      email: teacher.email ?? "",
      firstName: teacher.firstName,
      middleName: teacher.middleName ?? "",
      lastName: teacher.lastName,
      gender: teacher.gender,
      degree: teacher.degree ?? "",
      major: teacher.major ?? "",
    },
  });

  async function onSubmit(values: z.infer<typeof UpdateTeacherSchema>) {
    const result = await updateTeacher.mutateAsync({ id: teacher.id, values });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    onSuccess?.();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Personnel Information</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TeacherEditField
            label="Employee Number"
            error={form.formState.errors.employeeNumber?.message}
            input={<Input {...form.register("employeeNumber")} />}
          />
          <TeacherEditField
            label="Email (optional)"
            error={form.formState.errors.email?.message}
            input={<Input type="email" {...form.register("email")} />}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Personal Information
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TeacherEditField
            label="First Name"
            error={form.formState.errors.firstName?.message}
            input={<Input {...form.register("firstName")} />}
          />
          <TeacherEditField
            label="Middle Name"
            input={<Input {...form.register("middleName")} />}
          />
          <TeacherEditField
            label="Last Name"
            error={form.formState.errors.lastName?.message}
            input={<Input {...form.register("lastName")} />}
          />
          <Field>
            <FieldLabel>Gender</FieldLabel>
            <Select
               defaultValue={teacher.gender}
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
            <FieldError>{form.formState.errors.gender?.message}</FieldError>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Professional Information
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TeacherEditField
            label="Degree"
            input={<Input {...form.register("degree")} />}
          />
          <TeacherEditField
            label="Major"
            input={<Input {...form.register("major")} />}
          />
        </div>
      </section>

      <Button type="submit" disabled={updateTeacher.isPending}>
        {updateTeacher.isPending ? "Saving..." : "Update Teacher"}
      </Button>
    </form>
  );
}

function TeacherEditField({
  label,
  error,
  input,
}: {
  label: string;
  error?: string;
  input: ReactNode;
}) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      {input}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
