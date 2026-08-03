"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getStudentFilterOptionsAction,
  getStudentsAction,
} from "@/actions/student.action";
import type { StudentTableQueryInput } from "@/schemas";

export function useStudents(query: StudentTableQueryInput) {
  return useQuery({
    queryKey: ["students", query],
    queryFn: () => getStudentsAction(query),
    placeholderData: keepPreviousData,
  });
}

export function useStudentFilterOptions() {
  return useQuery({
    queryKey: ["students", "filter-options"],
    queryFn: getStudentFilterOptionsAction,
  });
}
