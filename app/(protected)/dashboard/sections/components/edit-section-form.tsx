"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useUpdateSection } from "@/hooks/section.hook";
import { type SectionListItem, UpdateSectionSchema } from "@/schemas";

import { SectionForm } from "./section-form";

interface EditSectionFormProps {
  section: SectionListItem;
  onSuccess?: () => void;
}

type UpdateSectionValues = z.infer<typeof UpdateSectionSchema>;

export function EditSectionForm({ section, onSuccess }: EditSectionFormProps) {
  const updateSection = useUpdateSection();
  const form = useForm<UpdateSectionValues>({
    resolver: zodResolver(UpdateSectionSchema),
    defaultValues: {
      gradeLevel: section.gradeLevel as UpdateSectionValues["gradeLevel"],
      sectionName: section.sectionName,
      adviserId: section.adviserId ?? "",
      room: section.room ?? "",
      shift: section.shift ?? undefined,
    },
  });

  async function onSubmit(values: UpdateSectionValues) {
    const result = await updateSection.mutateAsync({
      id: section.id,
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
      <SectionForm form={form} />
      <Button type="submit" disabled={updateSection.isPending}>
        {updateSection.isPending ? "Saving..." : "Update Section"}
      </Button>
    </form>
  );
}
