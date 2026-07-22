"use client";

import { useQuery } from "@tanstack/react-query";

import { getStudentsAction } from "@/actions/student.action";

export function useStudents() {
  return useQuery({
    queryKey: ["students"],
    queryFn: getStudentsAction,
  });
}