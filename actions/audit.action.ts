"use server";

import { Permissions, requirePermission } from "@/lib/authorization";
import {
  AuditLogIdSchema,
  ExportFormatSchema,
  validateAuditLogTableQuery,
  type AuditLogTableQueryInput,
} from "@/schemas";
import {
  getAuditLogDetail,
  getAuditLogFilterOptions,
  getAuditLogs,
  exportAuditLogs,
} from "@/services/audit.service";
import { ExportError } from "@/services/export.service";
import type { ExportActionResult, ExportFormat } from "@/types/export";

export async function getAuditLogsAction(query: AuditLogTableQueryInput) {
  await requirePermission(Permissions.AUDIT_LOGS);
  const validatedQuery = validateAuditLogTableQuery(query);

  if (!validatedQuery.success) {
    throw new Error("Invalid audit log query.");
  }

  return await getAuditLogs(validatedQuery.data);
}

export async function exportAuditLogsAction(
  query: AuditLogTableQueryInput,
  format: ExportFormat,
): Promise<ExportActionResult> {
  try {
    await requirePermission(Permissions.AUDIT_LOGS);
  } catch {
    return { error: "Unauthorized." };
  }

  const validatedQuery = validateAuditLogTableQuery(query);
  const validatedFormat = ExportFormatSchema.safeParse(format);

  if (!validatedQuery.success || !validatedFormat.success) {
    return { error: "Invalid export request." };
  }

  try {
    return {
      file: await exportAuditLogs(validatedQuery.data, validatedFormat.data),
    };
  } catch (error) {
    return {
      error:
        error instanceof ExportError
          ? error.message
          : "Unable to export audit records.",
    };
  }
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
