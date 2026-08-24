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
  transitionEnrollmentAction,
} from "@/actions/enrollment.action";
import {
  correctStudentEnrollmentPlacementAction,
  getStudentEnrollmentCorrectionContextAction,
} from "@/actions/student-enrollment-correction.action";
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

export function useStudentEnrollmentCorrectionContext(enrollmentId: string, enabled = true) {
  return useQuery({
    queryKey: ["student-enrollment-corrections", enrollmentId],
    queryFn: () => getStudentEnrollmentCorrectionContextAction(enrollmentId),
    enabled: enabled && Boolean(enrollmentId),
  });
}

export function useCorrectStudentEnrollmentPlacement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof correctStudentEnrollmentPlacementAction>[1];
    }) => correctStudentEnrollmentPlacementAction(id, values),
    onSuccess: async (result, values) => {
      if (result.error) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["enrollments"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({
          queryKey: ["student-enrollment-corrections", values.id],
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
    onSuccess: async (result, { id }) => {
      if (result.error) return;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["enrollments"] }),
        queryClient.invalidateQueries({ queryKey: ["students"] }),
        queryClient.invalidateQueries({ queryKey: ["shs-current-term-progression", id] }),
      ]);
    },
  });
}
