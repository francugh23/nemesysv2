"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { DashboardResponse } from "@/types/dashboard";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],

    queryFn: () => api.get<DashboardResponse>("/api/dashboard"),

    initialData: {
      students: 0,
      teachers: 0,
      sections: 0,
      subjects: 0,
    },
  });
}