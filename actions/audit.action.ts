"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  AuditLogIdSchema,
  validateAuditLogTableQuery,
  type AuditLogTableQueryInput,
} from "@/schemas";
import {
  getAuditLogDetail,
  getAuditLogFilterOptions,
  getAuditLogs,
} from "@/services/audit.service";

export async function getAuditLogsAction(query: AuditLogTableQueryInput) {
  await requirePermission(Permissions.AUDIT_LOGS);
  const validatedQuery = validateAuditLogTableQuery(query);

  if (!validatedQuery.success) {
    throw new Error("Invalid audit log query.");
  }

  return await getAuditLogs(validatedQuery.data);
}

export async function getAuditLogDetailAction(id: string) {
  await requirePermission(Permissions.AUDIT_LOGS);

  const validatedId = AuditLogIdSchema.safeParse(id);

  if (!validatedId.success) {
    throw new Error("Invalid audit log ID.");
  }

  return await getAuditLogDetail(validatedId.data);
}

export async function getAuditLogFilterOptionsAction() {
  await requirePermission(Permissions.AUDIT_LOGS);

  return await getAuditLogFilterOptions();
}
