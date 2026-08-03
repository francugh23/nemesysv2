"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  getAuditLogFilterOptionsAction,
  getAuditLogDetailAction,
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

export function useAuditLogDetail(id: string | null) {
  return useQuery({
    queryKey: ["audit-logs", "detail", id],
    queryFn: () => getAuditLogDetailAction(id!),
    enabled: Boolean(id),
  });
}
