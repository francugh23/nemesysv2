"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  archiveSubjectAction,
  createSubjectAction,
  getSubjectFilterOptionsAction,
  getSubjectsAction,
  updateSubjectAction,
} from "@/actions/subject.action";
import type { SubjectTableQueryInput } from "@/schemas";
import { invalidateSubjectQueries } from "@/hooks/query-invalidation";

export function useSubjects(query: SubjectTableQueryInput) {
  return useQuery({
    queryKey: ["subjects", query],
    queryFn: () => getSubjectsAction(query),
    placeholderData: keepPreviousData,
  });
}

export function useSubjectFilterOptions() {
  return useQuery({
    queryKey: ["subjects", "filter-options"],
    queryFn: getSubjectFilterOptionsAction,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSubjectAction,
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateSubjectQueries(queryClient);
      }
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof updateSubjectAction>[1];
    }) => updateSubjectAction(id, values),
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateSubjectQueries(queryClient);
      }
    },
  });
}

export function useArchiveSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveSubjectAction,
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateSubjectQueries(queryClient);
      }
    },
  });
}
