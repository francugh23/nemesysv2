"use client";

import { useQuery } from "@tanstack/react-query";

import { getSubjectsAction } from "@/actions/subject.action";

export function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: getSubjectsAction,
  });
}
