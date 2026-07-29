"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createSectionAction,
  getSectionFormOptionsAction,
  getSectionsAction,
} from "@/actions/section.action";

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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSectionAction,
    onSuccess: async (result) => {
      if (result.error) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sections"] }),
        queryClient.invalidateQueries({ queryKey: ["section-form-options"] }),
        queryClient.invalidateQueries({
          queryKey: ["subject-assignment-options"],
        }),
      ]);
    },
  });
}
