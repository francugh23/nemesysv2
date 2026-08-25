"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  dropShsStudentSubjectEnrollmentAction,
  getShsCurrentTermProgressionContextAction,
  getStudentSubjectEnrollmentsAction,
  progressShsCurrentTermAction,
} from "@/actions/student-subject-enrollment.action";
import {
  finalizeShsTermResultAction,
  reviseFinalizedShsTermResultAction,
  saveShsTermResultDraftAction,
} from "@/actions/shs-term-result.action";
import type {
  DropStudentSubjectEnrollmentInput,
  FinalizeShsTermResultInput,
  ReviseFinalizedShsTermResultInput,
  SaveShsTermResultDraftInput,
  ShsCurrentTermProgressionInput,
} from "@/schemas";

export type ShsCurrentTermProgressionContext = Awaited<
  ReturnType<typeof getShsCurrentTermProgressionContextAction>
>;

export function useStudentSubjectEnrollments(
  enrollmentId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["student-subject-enrollments", enrollmentId],
    queryFn: () => getStudentSubjectEnrollmentsAction({ enrollmentId }),
    enabled: enabled && Boolean(enrollmentId),
  });
}

export function useShsCurrentTermProgression(
  enrollmentId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ["shs-current-term-progression", enrollmentId],
    queryFn: () => getShsCurrentTermProgressionContextAction(enrollmentId),
    enabled: enabled && Boolean(enrollmentId),
  });
}

function useStudentSubjectEnrollmentInvalidation(enrollmentId: string) {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["student-subject-enrollments", enrollmentId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["shs-current-term-progression", enrollmentId],
      }),
    ]);
}

export function useProgressShsCurrentTerm(enrollmentId: string) {
  const invalidate = useStudentSubjectEnrollmentInvalidation(enrollmentId);

  return useMutation({
    mutationFn: (values: ShsCurrentTermProgressionInput) =>
      progressShsCurrentTermAction(values),
    onSuccess: async (result) => {
      if (!result.error) await invalidate();
    },
  });
}

export function useDropShsStudentSubjectEnrollment(enrollmentId: string) {
  const invalidate = useStudentSubjectEnrollmentInvalidation(enrollmentId);

  return useMutation({
    mutationFn: (values: DropStudentSubjectEnrollmentInput) =>
      dropShsStudentSubjectEnrollmentAction(values),
    onSuccess: async (result) => {
      if (!result.error) await invalidate();
    },
  });
}

function useShsTermResultInvalidation(enrollmentId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({
    queryKey: ["student-subject-enrollments", enrollmentId],
  });
}

export function useSaveShsTermResultDraft(enrollmentId: string) {
  const invalidate = useShsTermResultInvalidation(enrollmentId);
  return useMutation({
    mutationFn: (values: SaveShsTermResultDraftInput) =>
      saveShsTermResultDraftAction(values),
    onSuccess: async (result) => {
      if (!result.error) await invalidate();
    },
  });
}

export function useFinalizeShsTermResult(enrollmentId: string) {
  const invalidate = useShsTermResultInvalidation(enrollmentId);
  return useMutation({
    mutationFn: (values: FinalizeShsTermResultInput) =>
      finalizeShsTermResultAction(values),
    onSuccess: async (result) => {
      if (!result.error) await invalidate();
    },
  });
}

export function useReviseFinalizedShsTermResult(enrollmentId: string) {
  const invalidate = useShsTermResultInvalidation(enrollmentId);
  return useMutation({
    mutationFn: (values: ReviseFinalizedShsTermResultInput) => reviseFinalizedShsTermResultAction(values),
    onSuccess: async (result) => {
      if (!result.error) await invalidate();
    },
  });
}
