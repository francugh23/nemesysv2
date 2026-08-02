"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getSubjectAssignmentOptionsAction,
  getSubjectAssignmentsAction,
  updateSubjectAssignmentAction,
} from "@/actions/subject-assignment.action";

export function useSubjectAssignments() {
  return useQuery({
    queryKey: ["subject-assignments"],
    queryFn: getSubjectAssignmentsAction,
  });
}

export function useSubjectAssignmentOptions() {
  return useQuery({
    queryKey: ["subject-assignment-options"],
    queryFn: getSubjectAssignmentOptionsAction,
  });
}

export function useUpdateSubjectAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof updateSubjectAssignmentAction>[1];
    }) => updateSubjectAssignmentAction(id, values),
    onSuccess: async (result) => {
      if (result.error) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subject-assignments"] }),
        queryClient.invalidateQueries({
          queryKey: ["subject-assignment-options"],
        }),
      ]);
    },
  });
}
