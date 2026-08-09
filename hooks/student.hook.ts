"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createStudentAction,
  deleteStudentAction,
  getStudentFilterOptionsAction,
  getStudentsAction,
  updateStudentAction,
} from "@/actions/student.action";
import type { StudentTableQueryInput } from "@/schemas";
import { invalidateStudentQueries } from "@/hooks/query-invalidation";

export function useStudents(query: StudentTableQueryInput) {
  return useQuery({
    queryKey: ["students", query],
    queryFn: () => getStudentsAction(query),
    placeholderData: keepPreviousData,
  });
}

export function useStudentFilterOptions() {
  return useQuery({
    queryKey: ["students", "filter-options"],
    queryFn: getStudentFilterOptionsAction,
  });
}

export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createStudentAction,
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateStudentQueries(queryClient);
      }
    },
  });
}

export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof updateStudentAction>[1];
    }) => updateStudentAction(id, values),
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateStudentQueries(queryClient);
      }
    },
  });
}

export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteStudentAction,
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateStudentQueries(queryClient);
      }
    },
  });
}
