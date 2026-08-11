import { formatExportDateTime } from "@/lib/export/format";
import { formatFullName } from "@/lib/format";
import type { AuditLogExportProjection } from "@/repositories/audit.repository";

export const auditLogExportDefinition = {
  fileSlug: "audit-logs",
  sheetName: "Audit Logs",
  columns: [
    { header: "Timestamp" },
    { header: "Actor" },
    { header: "Username" },
    { header: "Module" },
    { header: "Action" },
    { header: "Record Name" },
    { header: "Record ID" },
    { header: "Description" },
  ],
  mapProjection: (auditLog: AuditLogExportProjection) => [
    formatExportDateTime(auditLog.createdAt),
    formatFullName(
      auditLog.user.firstName,
      auditLog.user.middleName,
      auditLog.user.lastName,
    ),
    auditLog.user.username,
    auditLog.module,
    auditLog.action,
    auditLog.recordName ?? "-",
    auditLog.recordId ?? "-",
    auditLog.description,
  ],
} as const;
