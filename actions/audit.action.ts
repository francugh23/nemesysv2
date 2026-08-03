"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  AuditLogTableQuerySchema,
  type AuditLogTableQueryInput,
} from "@/schemas";
import {
  getAuditLogFilterOptions,
  getAuditLogs,
} from "@/services/audit.service";

export async function getAuditLogsAction(query: AuditLogTableQueryInput) {
  await requirePermission(Permissions.AUDIT_LOGS);
  const validatedQuery = AuditLogTableQuerySchema.safeParse(query);

  if (!validatedQuery.success) {
    throw new Error("Invalid audit log query.");
  }

  return await getAuditLogs(validatedQuery.data);
}

export async function getAuditLogFilterOptionsAction() {
  await requirePermission(Permissions.AUDIT_LOGS);

  return await getAuditLogFilterOptions();
}
