"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAcademicTermAction,
  deleteAcademicTermAction,
  getAcademicTermsAction,
  updateAcademicTermAction,
} from "@/actions/academic-term.action";
import { invalidateAcademicTermQueries } from "@/hooks/query-invalidation";

export function useAcademicTerms(academicYearId: string, enabled = true) {
  return useQuery({
    queryKey: ["academic-terms", academicYearId],
    queryFn: () => getAcademicTermsAction(academicYearId),
    enabled: enabled && Boolean(academicYearId),
  });
}

function useAcademicTermInvalidation() {
  const queryClient = useQueryClient();
  return (academicYearId: string) =>
    invalidateAcademicTermQueries(queryClient, academicYearId);
}

export function useCreateAcademicTerm() {
  const invalidate = useAcademicTermInvalidation();
  return useMutation({
    mutationFn: ({ academicYearId, values }: {
      academicYearId: string;
      values: Parameters<typeof createAcademicTermAction>[1];
    }) => createAcademicTermAction(academicYearId, values),
    onSuccess: async (result, values) => {
      if (!result.error) await invalidate(values.academicYearId);
    },
  });
}

export function useUpdateAcademicTerm() {
  const invalidate = useAcademicTermInvalidation();
  return useMutation({
    mutationFn: ({ id, values }: {
      id: string;
      academicYearId: string;
      values: Parameters<typeof updateAcademicTermAction>[1];
    }) => updateAcademicTermAction(id, values),
    onSuccess: async (result, values) => {
      if (!result.error) await invalidate(values.academicYearId);
    },
  });
}

export function useDeleteAcademicTerm() {
  const invalidate = useAcademicTermInvalidation();
  return useMutation({
    mutationFn: ({ id }: { id: string; academicYearId: string }) =>
      deleteAcademicTermAction(id),
    onSuccess: async (result, values) => {
      if (!result.error) await invalidate(values.academicYearId);
    },
  });
}
