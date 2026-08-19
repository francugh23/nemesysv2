"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  commitCurriculumAdoptionAction,
  getCurriculumAdoptionOptionsAction,
  previewCurriculumAdoptionAction,
} from "@/actions/curriculum-adoption.action";
import type {
  CommitCurriculumAdoptionInput,
  CurriculumAdoptionPreviewInput,
} from "@/schemas";
import { invalidateAcademicYearConfigurationQueries } from "@/hooks/query-invalidation";

export function useCurriculumAdoptionPreview(values: CurriculumAdoptionPreviewInput | null) {
  return useQuery({
    queryKey: ["curriculum-adoption-preview", values],
    queryFn: () => previewCurriculumAdoptionAction(values),
    enabled: values !== null,
  });
}

export function useCurriculumAdoptionOptions(
  destinationAcademicYearId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["curriculum-adoption-options", destinationAcademicYearId],
    queryFn: () =>
      getCurriculumAdoptionOptionsAction({ destinationAcademicYearId }),
    enabled,
  });
}

export function useCommitCurriculumAdoption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: CommitCurriculumAdoptionInput) =>
      commitCurriculumAdoptionAction(values),
    onSuccess: async (result, values) => {
      if ("error" in result) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["curriculum-adoption-preview"] }),
        queryClient.invalidateQueries({ queryKey: ["subject-offerings"] }),
        queryClient.invalidateQueries({ queryKey: ["subject-offering-options"] }),
        queryClient.invalidateQueries({ queryKey: ["subject-offering-filter-options"] }),
        invalidateAcademicYearConfigurationQueries(
          queryClient,
          values.destinationAcademicYearId,
        ),
      ]);
    },
  });
}
