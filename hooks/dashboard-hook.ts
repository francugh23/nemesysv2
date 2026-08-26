"use client";

import { useQuery } from "@tanstack/react-query";

import { getOperationalDashboardAction, getOperationalDashboardSectionPageAction } from "@/actions/dashboard.action";

export const operationalDashboardQueryKey = ["dashboard", "operational"] as const;

export function useOperationalDashboard() {
  return useQuery({
    queryKey: operationalDashboardQueryKey,
    queryFn: getOperationalDashboardAction,
  });
}

export function useOperationalDashboardSectionPage(page: number, enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard", "operational", "sections", page],
    queryFn: () => getOperationalDashboardSectionPageAction(page),
    enabled,
  });
}
