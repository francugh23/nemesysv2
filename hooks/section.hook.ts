"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  archiveSectionAction,
  createSectionAction,
  getSectionFilterOptionsAction,
  getSectionFormOptionsAction,
  getSectionsAction,
  updateSectionAction,
} from "@/actions/section.action";
import type { SectionTableQueryInput } from "@/schemas";

function useInvalidateSectionQueries() {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sections"] }),
      queryClient.invalidateQueries({ queryKey: ["section-form-options"] }),
      queryClient.invalidateQueries({
        queryKey: ["subject-assignment-options"],
      }),
      queryClient.invalidateQueries({
        queryKey: ["enrollment-form-options"],
      }),
    ]);
  };
}

export function useSections(query: SectionTableQueryInput) {
  return useQuery({
    queryKey: ["sections", query],
    queryFn: () => getSectionsAction(query),
    placeholderData: keepPreviousData,
  });
}

export function useSectionFilterOptions() {
  return useQuery({
    queryKey: ["sections", "filter-options"],
    queryFn: getSectionFilterOptionsAction,
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
