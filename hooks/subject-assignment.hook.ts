"use client";

import { useQuery } from "@tanstack/react-query";

import { getSubjectAssignmentsAction } from "@/actions/subject-assignment.action";

export function useSubjectAssignments() {
  return useQuery({
    queryKey: ["subject-assignments"],
    queryFn: getSubjectAssignmentsAction,
  });
}
