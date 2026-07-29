"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveSectionAction,
  createSectionAction,
  getSectionFormOptionsAction,
  getSectionsAction,
  updateSectionAction,
} from "@/actions/section.action";

function useInvalidateSectionQueries() {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sections"] }),
      queryClient.invalidateQueries({ queryKey: ["section-form-options"] }),
      queryClient.invalidateQueries({
        queryKey: ["subject-assignment-options"],
      }),
    ]);
  };
}

export function useSections() {
  return useQuery({
    queryKey: ["sections"],
    queryFn: getSectionsAction,
  });
}

export function useSectionFormOptions() {
  return useQuery({
    queryKey: ["section-form-options"],
    queryFn: getSectionFormOptionsAction,
  });
}

export function useCreateSection() {
  const invalidateSectionQueries = useInvalidateSectionQueries();

  return useMutation({
    mutationFn: createSectionAction,
    onSuccess: async (result) => {
      if (result.error) {
        return;
      }

      await invalidateSectionQueries();
    },
  });
}

export function useUpdateSection() {
  const invalidateSectionQueries = useInvalidateSectionQueries();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof updateSectionAction>[1];
    }) => updateSectionAction(id, values),
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateSectionQueries();
      }
    },
  });
}

export function useArchiveSection() {
  const invalidateSectionQueries = useInvalidateSectionQueries();

  return useMutation({
    mutationFn: archiveSectionAction,
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateSectionQueries();
      }
    },
  });
}
