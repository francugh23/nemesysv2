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
import { invalidateOperationalDashboard, invalidateSectionQueries } from "@/hooks/query-invalidation";

function useInvalidateSectionQueries() {
  const queryClient = useQueryClient();

  return () => invalidateSectionQueries(queryClient);
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
  const queryClient = useQueryClient();
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
        await invalidateOperationalDashboard(queryClient);
      }
    },
  });
}

export function useArchiveSection() {
  const queryClient = useQueryClient();
  const invalidateSectionQueries = useInvalidateSectionQueries();

  return useMutation({
    mutationFn: archiveSectionAction,
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateSectionQueries();
        await invalidateOperationalDashboard(queryClient);
      }
    },
  });
}
