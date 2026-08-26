"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useCreateSection } from "@/hooks/section.hook";
import { CreateSectionSchema } from "@/schemas";

import { SectionForm } from "./section-form";

interface CreateSectionFormProps {
  onSuccess?: () => void;
}

export function CreateSectionForm({ onSuccess }: CreateSectionFormProps) {
  const createSection = useCreateSection();
  const form = useForm<z.infer<typeof CreateSectionSchema>>({
    resolver: zodResolver(CreateSectionSchema),
    defaultValues: {
      gradeLevel: undefined,
      sectionName: "",
      adviserId: "",
      room: "",
      shift: undefined,
    },
  });

  async function onSubmit(values: z.infer<typeof CreateSectionSchema>) {
    const result = await createSection.mutateAsync(values);

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
      <SectionForm form={form} />
      <Button type="submit" disabled={createSection.isPending}>
        {createSection.isPending ? "Creating..." : "Create Section"}
      </Button>
    </form>
  );
}
