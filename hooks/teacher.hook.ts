"use client";

import { useQuery } from "@tanstack/react-query";

import { getTeachersAction } from "@/actions/teacher.action";

export function useTeachers() {
  return useQuery({
    queryKey: ["teachers"],
    queryFn: getTeachersAction,
  });
}
