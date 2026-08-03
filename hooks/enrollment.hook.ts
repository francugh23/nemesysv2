"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createEnrollmentAction,
  getEnrollmentFormOptionsAction,
  getEnrollmentsAction,
  updateEnrollmentAction,
} from "@/actions/enrollment.action";

export function useEnrollments() {
  return useQuery({
    queryKey: ["enrollments"],
    queryFn: getEnrollmentsAction,
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

      await queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });
}
