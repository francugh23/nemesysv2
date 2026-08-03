import { auth } from "@/auth";
import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import {
  countAuditLogs,
  createAuditLog as createAuditLogRepository,
  findAuditLogById,
  findAuditLogFilterOptionValues,
  findAuditLogs,
} from "@/repositories/audit.repository";
import type {
  AuditLogFilterOptions,
  AuditLogDetail,
  AuditLogListItem,
  AuditLogPage,
  AuditLogTableQuery,
} from "@/schemas";

interface AuditLogInput {
  action: string;

  module: string;

  recordId?: string;

  recordName?: string;

  description: string;

  metadata?: Prisma.InputJsonValue;
}

export async function createAuditLog(data: AuditLogInput) {
  const session = await auth();

  if (!session?.user?.id) {
    return;
  }

  await createAuditLogRepository({
    action: data.action,

    module: data.module,

    recordId: data.recordId,

    recordName: data.recordName,

    description: data.description,

    metadata: data.metadata,

    user: {
      connect: {
        id: session.user.id,
      },
    },
  });
}

function toAuditLogDetail(
  auditLog: NonNullable<Awaited<ReturnType<typeof findAuditLogById>>>,
): AuditLogDetail {
  return {
    ...toAuditLogListItem(auditLog),
    metadata: auditLog.metadata,
  };
}

function getAuditLogOrderBy(
  query: AuditLogTableQuery,
): Prisma.AuditLogOrderByWithRelationInput[] {
  const direction = query.direction ?? "desc";

  switch (query.sort) {
    case "actor":
      return [
        { user: { lastName: direction } },
        { user: { firstName: direction } },
        { user: { middleName: direction } },
        { id: "asc" },
      ];
    case "module":
      return [{ module: direction }, { id: "asc" }];
    case "action":
      return [{ action: direction }, { id: "asc" }];
    case "record":
      return [{ recordName: direction }, { recordId: direction }, { id: "asc" }];
    case "description":
      return [{ description: direction }, { id: "asc" }];
    case "createdAt":
      return [{ createdAt: direction }, { id: "asc" }];
    default:
      return [{ createdAt: "desc" }, { id: "asc" }];
  }
}

function toAuditLogListItem(
  auditLog: Awaited<ReturnType<typeof findAuditLogs>>[number],
): AuditLogListItem {
  return {
    id: auditLog.id,
    action: auditLog.action,
    module: auditLog.module,
    recordId: auditLog.recordId,
    recordName: auditLog.recordName,
    description: auditLog.description,
    createdAt: auditLog.createdAt,
    actorId: auditLog.user.id,
    actorFirstName: auditLog.user.firstName,
    actorMiddleName: auditLog.user.middleName,
    actorLastName: auditLog.user.lastName,
    actorUsername: auditLog.user.username,
    actorEmployeeNumber: auditLog.user.employeeNumber,
  };
}

export async function getAuditLogs(
  query: AuditLogTableQuery,
): Promise<AuditLogPage> {
  await requirePermission(Permissions.AUDIT_LOGS);

  const filters = {
    search: query.q,
    module: query.module,
    action: query.action,
    actorId: query.actor,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  };
  const totalCount = await countAuditLogs(filters);
  const pageCount = Math.ceil(totalCount / query.pageSize);
  const page = Math.min(query.page, Math.max(pageCount, 1));
  const auditLogs = await findAuditLogs(
    filters,
    { skip: (page - 1) * query.pageSize, take: query.pageSize },
    getAuditLogOrderBy(query),
  );

  return {
    items: auditLogs.map(toAuditLogListItem),
    totalCount,
    page,
    pageSize: query.pageSize,
    pageCount,
  };
}

export async function getAuditLogDetail(id: string): Promise<AuditLogDetail> {
  await requirePermission(Permissions.AUDIT_LOGS);

  const auditLog = await findAuditLogById(id);

  if (!auditLog) {
    throw new Error("Audit log not found.");
  }

  return toAuditLogDetail(auditLog);
}

export async function getAuditLogFilterOptions(): Promise<AuditLogFilterOptions> {
  await requirePermission(Permissions.AUDIT_LOGS);

  const [modules, actions, actors] = await findAuditLogFilterOptionValues();

  return {
    modules: modules.map(({ module }) => module),
    actions: actions.map(({ action }) => action),
    actors: actors
      .map(({ user }) => user)
      .sort(
        (first, second) =>
          first.lastName.localeCompare(second.lastName) ||
          first.firstName.localeCompare(second.firstName) ||
          (first.middleName ?? "").localeCompare(second.middleName ?? ""),
      ),
  };
}
