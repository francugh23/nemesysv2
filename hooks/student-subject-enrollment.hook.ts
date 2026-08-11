"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getEligibleShsOfferingsForEnrollmentAction, getStudentSubjectEnrollmentsAction, selectShsStudentCurriculumAction } from "@/actions/student-subject-enrollment.action";

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

export function useEligibleShsOfferingsForEnrollment(enrollmentId: string, enabled = true) { return useQuery({ queryKey: ["eligible-shs-offerings", enrollmentId], queryFn: () => getEligibleShsOfferingsForEnrollmentAction(enrollmentId), enabled: enabled && Boolean(enrollmentId) }); }
export function useSelectShsStudentCurriculum(enrollmentId: string) { const queryClient = useQueryClient(); return useMutation({ mutationFn: selectShsStudentCurriculumAction, onSuccess: async (result) => { if (!result.error) await queryClient.invalidateQueries({ queryKey: ["student-subject-enrollments", enrollmentId] }); } }); }
