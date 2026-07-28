"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { createSubjectAction } from "@/actions/subject.action";
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
import { CreateSubjectSchema } from "@/schemas";

interface SubjectFormProps {
  onSuccess?: () => void;
}

export function SubjectForm({ onSuccess }: SubjectFormProps) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof CreateSubjectSchema>>({
    resolver: zodResolver(CreateSubjectSchema),
    defaultValues: {
      code: "",
      description: "",
      gradeLevel: "",
      trackStrand: "",
      semester: undefined,
    },
  });

  function onSubmit(values: z.infer<typeof CreateSubjectSchema>) {
    startTransition(async () => {
      const result = await createSubjectAction(values);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      await queryClient.invalidateQueries({
        queryKey: ["subjects"],
      });
      form.reset();
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field>
          <FieldLabel>Subject Code</FieldLabel>
          <Input {...form.register("code")} />
          <FieldError>{form.formState.errors.code?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel>Grade Level</FieldLabel>
          <Input {...form.register("gradeLevel")} />
          <FieldError>{form.formState.errors.gradeLevel?.message}</FieldError>
        </Field>

        <Field className="md:col-span-2">
          <FieldLabel>Description</FieldLabel>
          <Input {...form.register("description")} />
          <FieldError>{form.formState.errors.description?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel>Track / Strand</FieldLabel>
          <Input {...form.register("trackStrand")} />
        </Field>

        <Field>
          <FieldLabel>Semester</FieldLabel>
          <Select
            onValueChange={(value) =>
              form.setValue("semester", value as "FIRST" | "SECOND", {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FIRST">First</SelectItem>
              <SelectItem value="SECOND">Second</SelectItem>
            </SelectContent>
          </Select>
          <FieldError>{form.formState.errors.semester?.message}</FieldError>
        </Field>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Subject"}
      </Button>
    </form>
  );
}
