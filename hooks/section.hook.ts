"use client";

import { useQuery } from "@tanstack/react-query";

import { getSectionsAction } from "@/actions/section.action";

export function useSections() {
  return useQuery({
    queryKey: ["sections"],
    queryFn: getSectionsAction,
  });
}
