"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createTeacherAction } from "@/actions/teacher.action";
import { Button } from "@/components/ui/button";
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
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof CreateTeacherSchema>>({
    resolver: zodResolver(CreateTeacherSchema),
    defaultValues: {
      employeeNumber: "",
      username: "",
      email: "",
      temporaryPassword: "",
      firstName: "",
      middleName: "",
      lastName: "",
      gender: "MALE",
      degree: "",
      major: "",
    },
  });

  function onSubmit(values: z.infer<typeof CreateTeacherSchema>) {
    startTransition(async () => {
      const result = await createTeacherAction(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      await queryClient.invalidateQueries({
        queryKey: ["teachers"],
      });
      form.reset();
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Account Information
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel>Employee Number</FieldLabel>
            <Input {...form.register("employeeNumber")} />
            <FieldError>
              {form.formState.errors.employeeNumber?.message}
            </FieldError>
          </Field>

          <Field>
            <FieldLabel>Username</FieldLabel>
            <Input {...form.register("username")} />
            <FieldError>{form.formState.errors.username?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel>Email</FieldLabel>
            <Input type="email" {...form.register("email")} />
            <FieldError>{form.formState.errors.email?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel>Temporary Password</FieldLabel>
            <Input type="password" {...form.register("temporaryPassword")} />
            <FieldError>
              {form.formState.errors.temporaryPassword?.message}
            </FieldError>
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

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Teacher"}
      </Button>
    </form>
  );
}
