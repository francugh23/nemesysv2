"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createEnrollmentAction,
  correctEnrollmentPlacementAction,
  getEnrollmentFilterOptionsAction,
  getEnrollmentFormOptionsAction,
  getEnrollmentsAction,
  transitionEnrollmentAction,
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

export function useCorrectEnrollmentPlacement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof correctEnrollmentPlacementAction>[1];
    }) => correctEnrollmentPlacementAction(id, values),
    onSuccess: async (result, values) => {
      if (result.error) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["enrollments"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({
          queryKey: ["student-subject-enrollments", values.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["enrollment-filter-options"],
        }),
      ]);
    },
  });
}

export function useTransitionEnrollment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof transitionEnrollmentAction>[1];
    }) => transitionEnrollmentAction(id, values),
    onSuccess: async (result) => {
      if (result.error) return;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["enrollments"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["eligible-shs-offerings"] }),
      ]);
    },
  });
}
