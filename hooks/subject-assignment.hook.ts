"use client";

import { useQuery } from "@tanstack/react-query";

import {
  getSubjectAssignmentOptionsAction,
  getSubjectAssignmentsAction,
} from "@/actions/subject-assignment.action";

export function useSubjectAssignments() {
  return useQuery({
    queryKey: ["subject-assignments"],
    queryFn: getSubjectAssignmentsAction,
  });
}

export function useSubjectAssignmentOptions() {
  return useQuery({
    queryKey: ["subject-assignment-options"],
    queryFn: getSubjectAssignmentOptionsAction,
  });
}
