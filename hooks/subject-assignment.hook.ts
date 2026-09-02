"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveSubjectAssignmentAction,
  mutateAssignmentMatrixAction,
  getSubjectAssignmentOptionsAction,
  getAssignmentMatrixAction,
  getSubjectAssignmentHistoryAction,
  getSubjectAssignmentHistoryFilterOptionsAction,
  getSubjectAssignmentHistoryOptionsAction,
  getSubjectAssignmentImportTemplateAction,
  getSubjectAssignmentsAction,
  exportSubjectAssignmentsAction,
  previewSubjectAssignmentImportAction,
  updateSubjectAssignmentAction,
} from "@/actions/subject-assignment.action";

export function useSubjectAssignments() {
  return useQuery({
    queryKey: ["subject-assignments"],
    queryFn: getSubjectAssignmentsAction,
  });
}

export function useSubjectAssignmentHistory(
  query: Parameters<typeof getSubjectAssignmentHistoryAction>[0],
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["subject-assignments", "history", query],
    queryFn: () => getSubjectAssignmentHistoryAction(query),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useSubjectAssignmentHistoryFilterOptions(
  query: Parameters<typeof getSubjectAssignmentHistoryFilterOptionsAction>[0],
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["subject-assignments", "history-filter-options", query],
    queryFn: () => getSubjectAssignmentHistoryFilterOptionsAction(query),
    enabled,
  });
}

export function useSubjectAssignmentHistoryOptions(
  query: Parameters<typeof getSubjectAssignmentHistoryOptionsAction>[0],
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["subject-assignments", "history-options", query],
    queryFn: () => getSubjectAssignmentHistoryOptionsAction(query),
    enabled,
  });
}

export function useSubjectAssignmentOptions() {
  return useQuery({
    queryKey: ["subject-assignment-options"],
    queryFn: getSubjectAssignmentOptionsAction,
  });
}

export function useAssignmentMatrix(query: { academicYearId?: string; gradeLevel: "7" | "8" | "9" | "10" | "11" | "12" }) {
  return useQuery({ queryKey: ["assignment-matrix", query], queryFn: () => getAssignmentMatrixAction(query) });
}

export function usePreviewSubjectAssignmentImport() {
  return useMutation({
    mutationFn: ({ rows, gradeLevel, page }: { rows: Record<string, unknown>[]; gradeLevel: "7" | "8" | "9" | "10" | "11" | "12"; page: number }) => previewSubjectAssignmentImportAction(rows, gradeLevel, page),
  });
}

export function useExportSubjectAssignments() {
  return useMutation({
    mutationFn: (gradeLevel: "7" | "8" | "9" | "10" | "11" | "12") => exportSubjectAssignmentsAction(gradeLevel),
  });
}

export function useSubjectAssignmentImportTemplate() {
  return useMutation({
    mutationFn: getSubjectAssignmentImportTemplateAction,
  });
}

export function useMutateAssignmentMatrix() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mutateAssignmentMatrixAction,
    onSuccess: async (result) => {
      if (result.error) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["assignment-matrix"] }),
        queryClient.invalidateQueries({ queryKey: ["subject-assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["subject-assignment-options"] }),
      ]);
    },
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
        queryClient.invalidateQueries({ queryKey: ["assignment-matrix"] }),
        queryClient.invalidateQueries({
          queryKey: ["subject-assignment-options"],
        }),
      ]);
    },
  });
}

export function useArchiveSubjectAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveSubjectAssignmentAction,
    onSuccess: async (result) => {
      if (result.error) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["subject-assignments"] }),
        queryClient.invalidateQueries({ queryKey: ["assignment-matrix"] }),
        queryClient.invalidateQueries({
          queryKey: ["subject-assignment-options"],
        }),
      ]);
    },
  });
}
