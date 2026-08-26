"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createShsElectiveEnrollmentPolicyAction,
  getShsElectiveEnrollmentPoliciesAction,
  updateShsElectiveEnrollmentPolicyAction,
} from "@/actions/shs-elective-enrollment-policy.action";
import type {
  CreateShsElectiveEnrollmentPolicyInput,
  UpdateShsElectiveEnrollmentPolicyInput,
} from "@/schemas";
import { invalidateAcademicYearConfigurationQueries, invalidateOperationalDashboard } from "@/hooks/query-invalidation";

export type ShsElectiveEnrollmentPolicy = Awaited<
  ReturnType<typeof getShsElectiveEnrollmentPoliciesAction>
>[number];

export function useShsElectiveEnrollmentPolicies(
  academicYearId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["shs-elective-enrollment-policies", academicYearId],
    queryFn: () =>
      getShsElectiveEnrollmentPoliciesAction({ academicYearId }),
    enabled: enabled && Boolean(academicYearId),
  });
}

function usePolicyInvalidation() {
  const queryClient = useQueryClient();

  return (academicYearId: string) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["shs-elective-enrollment-policies", academicYearId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["shs-current-term-progression"],
      }),
      invalidateAcademicYearConfigurationQueries(queryClient, academicYearId),
      invalidateOperationalDashboard(queryClient),
    ]);
}

export function useCreateShsElectiveEnrollmentPolicy() {
  const invalidate = usePolicyInvalidation();

  return useMutation({
    mutationFn: (values: CreateShsElectiveEnrollmentPolicyInput) =>
      createShsElectiveEnrollmentPolicyAction(values),
    onSuccess: async (result, values) => {
      if (!result.error) await invalidate(values.academicYearId);
    },
  });
}

export function useUpdateShsElectiveEnrollmentPolicy() {
  const invalidate = usePolicyInvalidation();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: UpdateShsElectiveEnrollmentPolicyInput;
    }) => updateShsElectiveEnrollmentPolicyAction(id, values),
    onSuccess: async (result, { values }) => {
      if (!result.error) await invalidate(values.academicYearId);
    },
  });
}
