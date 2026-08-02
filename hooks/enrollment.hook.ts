"use client";

import { useQuery } from "@tanstack/react-query";

import { getEnrollmentsAction } from "@/actions/enrollment.action";

export function useEnrollments() {
  return useQuery({
    queryKey: ["enrollments"],
    queryFn: getEnrollmentsAction,
  });
}
