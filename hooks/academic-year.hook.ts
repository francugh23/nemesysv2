"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  activateAcademicYearAction,
  archiveAcademicYearAction,
  createAcademicYearAction,
  getAcademicYearFilterOptionsAction,
  getAcademicYearsAction,
  lockAcademicYearAction,
  updateAcademicYearAction,
} from "@/actions/academic-year.action";
import { invalidateAcademicYearQueries } from "@/hooks/query-invalidation";
import type { AcademicYearTableQueryInput } from "@/schemas";

export function useAcademicYears(query: AcademicYearTableQueryInput) {
  return useQuery({
    queryKey: ["academic-years", query],
    queryFn: () => getAcademicYearsAction(query),
    placeholderData: keepPreviousData,
  });
}

export function useAcademicYearFilterOptions() {
  return useQuery({
    queryKey: ["academic-years", "filter-options"],
    queryFn: getAcademicYearFilterOptionsAction,
  });
}

function useAcademicYearInvalidation() {
  const queryClient = useQueryClient();

  return () => invalidateAcademicYearQueries(queryClient);
}

function useAcademicYearStatusMutation(
  mutationFn: (id: string) => Promise<Awaited<ReturnType<typeof lockAcademicYearAction>>>,
) {
  const invalidate = useAcademicYearInvalidation();

  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidate();
      }
    },
  });
}

export function useCreateAcademicYear() {
  const invalidate = useAcademicYearInvalidation();

  return useMutation({
    mutationFn: createAcademicYearAction,
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidate();
      }
    },
  });
}

export function useUpdateAcademicYear() {
  const invalidate = useAcademicYearInvalidation();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<typeof updateAcademicYearAction>[1];
    }) => updateAcademicYearAction(id, values),
    onSuccess: async (result) => {
      if (!result.error) {
        await invalidate();
      }
    },
  });
}

export function useActivateAcademicYear() {
  return useAcademicYearStatusMutation(activateAcademicYearAction);
}

export function useLockAcademicYear() {
  return useAcademicYearStatusMutation(lockAcademicYearAction);
}

export function useArchiveAcademicYear() {
  return useAcademicYearStatusMutation(archiveAcademicYearAction);
}
