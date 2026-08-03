"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createEnrollmentAction,
  getEnrollmentFilterOptionsAction,
  getEnrollmentFormOptionsAction,
  getEnrollmentsAction,
  updateEnrollmentAction,
} from "@/actions/enrollment.action";
import type { EnrollmentTableQueryInput } from "@/schemas";

export function useEnrollments(query: EnrollmentTableQueryInput) {
  return useQuery({
    queryKey: ["enrollments", query],
    queryFn: () => getEnrollmentsAction(query),
    placeholderData: keepPreviousData,
  });
}

export function useEnrollmentFilterOptions() {
  return useQuery({
    queryKey: ["enrollment-filter-options"],
    queryFn: getEnrollmentFilterOptionsAction,
  });
}

export function useEnrollmentFormOptions() {
  return useQuery({
    queryKey: ["enrollment-form-options"],
    queryFn: getEnrollmentFormOptionsAction,
  });
}

export function useCreateEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createEnrollmentAction,
    onSuccess: async (result) => {
      if (result.error) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["enrollments"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({
          queryKey: ["enrollment-filter-options"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["enrollment-form-options"],
        }),
      ]);
    },
  });
}

export function useUpdateEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof updateEnrollmentAction>[1];
    }) => updateEnrollmentAction(id, values),
    onSuccess: async (result) => {
      if (result.error) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["enrollments"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({
          queryKey: ["enrollment-filter-options"],
        }),
      ]);
    },
  });
}
