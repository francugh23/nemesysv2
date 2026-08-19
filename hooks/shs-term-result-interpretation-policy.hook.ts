"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getShsTermResultInterpretationPolicyAction,
  publishShsTermResultInterpretationPolicyAction,
  saveShsTermResultInterpretationPolicyDraftAction,
} from "@/actions/shs-term-result-interpretation-policy.action";
import type {
  PublishShsTermResultInterpretationPolicyInput,
  SaveShsTermResultInterpretationPolicyDraftInput,
} from "@/schemas";

export function useShsTermResultInterpretationPolicy(
  academicYearId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["shs-term-result-interpretation-policy", academicYearId],
    queryFn: () => getShsTermResultInterpretationPolicyAction({ academicYearId }),
    enabled: enabled && Boolean(academicYearId),
  });
}

function usePolicyInvalidation() {
  const queryClient = useQueryClient();
  return (academicYearId: string, invalidateResults: boolean) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["shs-term-result-interpretation-policy", academicYearId],
      }),
      ...(invalidateResults
        ? [queryClient.invalidateQueries({ queryKey: ["student-subject-enrollments"] })]
        : []),
    ]);
}

export function useSaveShsTermResultInterpretationPolicyDraft() {
  const invalidate = usePolicyInvalidation();
  return useMutation({
    mutationFn: (values: SaveShsTermResultInterpretationPolicyDraftInput) =>
      saveShsTermResultInterpretationPolicyDraftAction(values),
    onSuccess: async (result, values) => {
      if (!result.error) await invalidate(values.academicYearId, false);
    },
  });
}

export function usePublishShsTermResultInterpretationPolicy() {
  const invalidate = usePolicyInvalidation();
  return useMutation({
    mutationFn: (values: PublishShsTermResultInterpretationPolicyInput) =>
      publishShsTermResultInterpretationPolicyAction(values),
    onSuccess: async (result, values) => {
      if (!result.error) await invalidate(values.academicYearId, true);
    },
  });
}
