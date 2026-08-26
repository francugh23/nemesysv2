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
  correctStudentEnrollmentGradePlacementAction,
  correctStudentEnrollmentPlacementAction,
  getStudentEnrollmentGradeCorrectionPreviewAction,
  getStudentEnrollmentCorrectionContextAction,
} from "@/actions/student-enrollment-correction.action";
import {
  correctShsStudentParticipationAction,
  getShsStudentParticipationCorrectionContextAction,
  getShsStudentParticipationCorrectionHistoryAction,
  getShsStudentParticipationCorrectionPreviewAction,
} from "@/actions/shs-student-participation-correction.action";
import type { EnrollmentTableQueryInput } from "@/schemas";
import { invalidateOperationalDashboard } from "@/hooks/query-invalidation";

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
          invalidateOperationalDashboard(queryClient),
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

export function useStudentEnrollmentGradeCorrectionPreview(
  enrollmentId: string,
  destinationSectionId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: [
      "student-enrollment-grade-correction-preview",
      enrollmentId,
      destinationSectionId,
    ],
    queryFn: () =>
      getStudentEnrollmentGradeCorrectionPreviewAction(
        enrollmentId,
        destinationSectionId,
      ),
    enabled:
      enabled && Boolean(enrollmentId) && Boolean(destinationSectionId),
  });
}

export function useShsStudentParticipationCorrectionContext(enrollmentId: string, enabled = true) {
  return useQuery({ queryKey: ["shs-student-participation-correction-context", enrollmentId], queryFn: () => getShsStudentParticipationCorrectionContextAction(enrollmentId), enabled: enabled && Boolean(enrollmentId) });
}

export function useShsStudentParticipationCorrectionPreview(enrollmentId: string, sourceStudentSubjectEnrollmentId: string, sourceAcademicTermId: string, enabled = true) {
  return useQuery({ queryKey: ["shs-student-participation-correction-preview", enrollmentId, sourceStudentSubjectEnrollmentId, sourceAcademicTermId], queryFn: () => getShsStudentParticipationCorrectionPreviewAction(enrollmentId, sourceStudentSubjectEnrollmentId, sourceAcademicTermId), enabled: enabled && Boolean(enrollmentId) && Boolean(sourceStudentSubjectEnrollmentId) && Boolean(sourceAcademicTermId) });
}

export function useShsStudentParticipationCorrectionHistory(enrollmentId: string, enabled = true) {
  return useQuery({ queryKey: ["shs-student-participation-correction-history", enrollmentId], queryFn: () => getShsStudentParticipationCorrectionHistoryAction(enrollmentId), enabled: enabled && Boolean(enrollmentId) });
}

export function useCorrectShsStudentParticipation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Parameters<typeof correctShsStudentParticipationAction>[1] }) => correctShsStudentParticipationAction(id, values),
    onSuccess: async (result, { id }) => {
      if (result.error) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["student-subject-enrollments", id] }),
        queryClient.invalidateQueries({ queryKey: ["shs-current-term-progression", id] }),
        queryClient.invalidateQueries({ queryKey: ["shs-student-participation-correction-context", id] }),
        queryClient.invalidateQueries({ queryKey: ["shs-student-participation-correction-preview", id] }),
        queryClient.invalidateQueries({ queryKey: ["shs-student-participation-correction-history", id] }),
        invalidateOperationalDashboard(queryClient),
      ]);
    },
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
        invalidateOperationalDashboard(queryClient),
      ]);
    },
  });
}

export function useCorrectStudentEnrollmentGradePlacement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      values,
    }: {
      id: string;
      values: Parameters<
        typeof correctStudentEnrollmentGradePlacementAction
      >[1];
    }) => correctStudentEnrollmentGradePlacementAction(id, values),
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
          queryKey: ["student-enrollment-grade-correction-preview", values.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["student-subject-enrollments", values.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["enrollment-filter-options"],
        }),
        invalidateOperationalDashboard(queryClient),
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
        invalidateOperationalDashboard(queryClient),
      ]);
    },
  });
}
