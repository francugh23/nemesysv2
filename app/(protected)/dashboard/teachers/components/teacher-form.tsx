"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useCreateTeacher } from "@/hooks/teacher.hook";
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
import { CreateTeacherSchema } from "@/schemas";

interface TeacherFormProps {
  onSuccess?: () => void;
}

export function TeacherForm({ onSuccess }: TeacherFormProps) {
  const createTeacher = useCreateTeacher();
  const form = useForm<z.infer<typeof CreateTeacherSchema>>({
    resolver: zodResolver(CreateTeacherSchema),
    defaultValues: {
      employeeNumber: "",
      email: "",
      firstName: "",
      middleName: "",
      lastName: "",
      gender: "MALE",
      degree: "",
      major: "",
    },
  });

  async function onSubmit(values: z.infer<typeof CreateTeacherSchema>) {
    const result = await createTeacher.mutateAsync(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.success);
    form.reset();
    onSuccess?.();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Personnel Information</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel>Employee Number</FieldLabel>
            <Input {...form.register("employeeNumber")} />
            <FieldError>
              {form.formState.errors.employeeNumber?.message}
            </FieldError>
          </Field>

          <Field>
            <FieldLabel>Email (optional)</FieldLabel>
            <Input type="email" {...form.register("email")} />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Personal Information
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            <FieldLabel>Gender</FieldLabel>
            <Select
              defaultValue="MALE"
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
          <Field>
            <FieldLabel>Degree</FieldLabel>
            <Input {...form.register("degree")} />
          </Field>

          <Field>
            <FieldLabel>Major</FieldLabel>
            <Input {...form.register("major")} />
          </Field>
        </div>
      </section>

      <Button type="submit" disabled={createTeacher.isPending}>
        {createTeacher.isPending ? "Creating..." : "Create Teacher"}
      </Button>
    </form>
  );
}
