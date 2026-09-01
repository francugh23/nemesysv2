"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createTeacherAction,
  archiveTeacherAction,
  deactivateTeacherAction,
  getTeacherFilterOptionsAction,
  getTeachersAction,
  updateTeacherAction,
} from "@/actions/teacher.action";
import type { TeacherTableQueryInput } from "@/schemas";
import { invalidateOperationalDashboard, invalidateTeacherQueries } from "@/hooks/query-invalidation";

export function useTeachers(query: TeacherTableQueryInput) {
  return useQuery({
    queryKey: ["teachers", query],
    queryFn: () => getTeachersAction(query),
    placeholderData: keepPreviousData,
  });
}

export function useTeacherFilterOptions() {
  return useQuery({
    queryKey: ["teachers", "filter-options"],
    queryFn: getTeacherFilterOptionsAction,
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTeacherAction,
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateTeacherQueries(queryClient);
        await invalidateOperationalDashboard(queryClient);
      }
    },
  });
}

export function useUpdateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof updateTeacherAction>[1];
    }) => updateTeacherAction(id, values),
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateTeacherQueries(queryClient);
        await invalidateOperationalDashboard(queryClient);
      }
    },
  });
}

export function useDeactivateTeacher() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deactivateTeacherAction,
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateTeacherQueries(queryClient);
        await invalidateOperationalDashboard(queryClient);
      }
    },
  });
}

export function useArchiveTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveTeacherAction,
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidateTeacherQueries(queryClient);
        await invalidateOperationalDashboard(queryClient);
      }
    },
  });
}
