"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invalidateAcademicYearConfigurationQueries } from "@/hooks/query-invalidation";

import {
  archiveShsCurriculumClusterAction,
  archiveSubjectOfferingAction,
  createShsCurriculumClusterAction,
  createSubjectOfferingAction,
  correctSubjectOfferingAction,
  getCurriculumCorrectionContextAction,
  getCurriculumCorrectionDetailAction,
  getShsCurriculumClustersAction,
  getSubjectOfferingOptionsAction,
  getSubjectOfferingFilterOptionsAction,
  getSubjectOfferingsAction,
  updateShsCurriculumClusterAction,
  updateSubjectOfferingAction,
  promoteShsSubjectOfferingAction,
} from "@/actions/subject-offering.action";

export function useSubjectOfferings(query: Parameters<typeof getSubjectOfferingsAction>[0]) { return useQuery({ queryKey: ["subject-offerings", query], queryFn: () => getSubjectOfferingsAction(query), placeholderData: keepPreviousData }); }
export function useSubjectOfferingOptions() { return useQuery({ queryKey: ["subject-offering-options"], queryFn: getSubjectOfferingOptionsAction }); }
export function useSubjectOfferingFilterOptions() { return useQuery({ queryKey: ["subject-offering-filter-options"], queryFn: getSubjectOfferingFilterOptionsAction }); }
export function useShsCurriculumClusters() { return useQuery({ queryKey: ["shs-curriculum-clusters"], queryFn: getShsCurriculumClustersAction }); }
export function useCurriculumCorrectionContext(sourceOfferingId: string, enabled = true) {
  return useQuery({
    queryKey: ["curriculum-correction-context", sourceOfferingId],
    queryFn: () => getCurriculumCorrectionContextAction(sourceOfferingId),
    enabled: enabled && Boolean(sourceOfferingId),
  });
}
export function useCurriculumCorrectionDetail(subjectOfferingId: string, enabled = true) {
  return useQuery({
    queryKey: ["curriculum-correction-detail", subjectOfferingId],
    queryFn: () => getCurriculumCorrectionDetailAction(subjectOfferingId),
    enabled: enabled && Boolean(subjectOfferingId),
  });
}
function useInvalidate(invalidateSubjects = false) {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["subject-offerings"] }),
    queryClient.invalidateQueries({ queryKey: ["subject-offering-options"] }),
    queryClient.invalidateQueries({ queryKey: ["subject-offering-filter-options"] }),
    ...(invalidateSubjects
      ? [queryClient.invalidateQueries({ queryKey: ["subjects"] })]
      : []),
    queryClient.invalidateQueries({ queryKey: ["shs-curriculum-clusters"] }),
    queryClient.invalidateQueries({ queryKey: ["curriculum-adoption-preview"] }),
    queryClient.invalidateQueries({ queryKey: ["shs-current-term-progression"] }),
    queryClient.invalidateQueries({ queryKey: ["curriculum-correction-context"] }),
    queryClient.invalidateQueries({ queryKey: ["curriculum-correction-detail"] }),
    invalidateAcademicYearConfigurationQueries(queryClient),
  ]);
}

export function useCreateSubjectOffering() { const invalidate = useInvalidate(true); return useMutation({ mutationFn: createSubjectOfferingAction, onSuccess: async (result) => { if (!result.error) await invalidate(); } }); }
export function useUpdateSubjectOffering() { const invalidate = useInvalidate(true); return useMutation({ mutationFn: ({ id, values }: { id: string; values: unknown }) => updateSubjectOfferingAction(id, values), onSuccess: async (result) => { if (!result.error) await invalidate(); } }); }
export function useArchiveSubjectOffering() { const invalidate = useInvalidate(true); return useMutation({ mutationFn: archiveSubjectOfferingAction, onSuccess: async (result) => { if (!result.error) await invalidate(); } }); }
export function usePromoteShsSubjectOffering() { const invalidate = useInvalidate(); return useMutation({ mutationFn: promoteShsSubjectOfferingAction, onSuccess: async (result) => { if (!result.error) await invalidate(); } }); }
export function useCorrectSubjectOffering() { const invalidate = useInvalidate(true); return useMutation({ mutationFn: correctSubjectOfferingAction, onSuccess: async (result) => { if (!("error" in result)) await invalidate(); } }); }
export function useCreateShsCurriculumCluster() { const invalidate = useInvalidate(); return useMutation({ mutationFn: createShsCurriculumClusterAction, onSuccess: async (result) => { if (!result.error) await invalidate(); } }); }
export function useUpdateShsCurriculumCluster() { const invalidate = useInvalidate(); return useMutation({ mutationFn: ({ id, values }: { id: string; values: unknown }) => updateShsCurriculumClusterAction(id, values), onSuccess: async (result) => { if (!result.error) await invalidate(); } }); }
export function useArchiveShsCurriculumCluster() { const invalidate = useInvalidate(); return useMutation({ mutationFn: archiveShsCurriculumClusterAction, onSuccess: async (result) => { if (!result.error) await invalidate(); } }); }
