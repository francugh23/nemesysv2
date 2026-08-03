"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getTeacherFilterOptionsAction,
  getTeachersAction,
} from "@/actions/teacher.action";
import type { TeacherTableQueryInput } from "@/schemas";

export function useTeachers(query: TeacherTableQueryInput) {
  return useQuery({
    queryKey: ["teachers", query],
    queryFn: () => getTeachersAction(query),
    placeholderData: keepPreviousData,
  });
}

export function useTeacherFilterOptions() {
  return useQuery({
    queryKey: ["teachers", "filter-options"],
    queryFn: getTeacherFilterOptionsAction,
  });
}
