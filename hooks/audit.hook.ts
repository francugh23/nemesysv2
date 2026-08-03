"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getAuditLogFilterOptionsAction,
  getAuditLogsAction,
} from "@/actions/audit.action";
import type { AuditLogTableQueryInput } from "@/schemas";

export function useAuditLogs(query: AuditLogTableQueryInput) {
  return useQuery({
    queryKey: ["audit-logs", query],
    queryFn: () => getAuditLogsAction(query),
    placeholderData: keepPreviousData,
  });
}

export function useAuditLogFilterOptions() {
  return useQuery({
    queryKey: ["audit-logs", "filter-options"],
    queryFn: getAuditLogFilterOptionsAction,
  });
}
