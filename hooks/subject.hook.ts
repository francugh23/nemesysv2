"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getSubjectFilterOptionsAction,
  getSubjectsAction,
} from "@/actions/subject.action";
import type { SubjectTableQueryInput } from "@/schemas";

export function useSubjects(query: SubjectTableQueryInput) {
  return useQuery({
    queryKey: ["subjects", query],
    queryFn: () => getSubjectsAction(query),
    placeholderData: keepPreviousData,
  });
}

export function useSubjectFilterOptions() {
  return useQuery({
    queryKey: ["subjects", "filter-options"],
    queryFn: getSubjectFilterOptionsAction,
  });
}
