"use client";

import { useQuery } from "@tanstack/react-query";

import { getStudentSubjectEnrollmentsAction } from "@/actions/student-subject-enrollment.action";

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
