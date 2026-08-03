import prisma from "@/lib/prisma";

import { Prisma } from "@/app/generated/prisma/client";

export interface AuditLogListFilters {
  search?: string;
  module?: string;
  action?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const auditLogListSelect = {
  id: true,
  action: true,
  module: true,
  recordId: true,
  recordName: true,
  description: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      username: true,
      employeeNumber: true,
    },
  },
} satisfies Prisma.AuditLogSelect;

const auditLogDetailSelect = {
  ...auditLogListSelect,
  metadata: true,
} satisfies Prisma.AuditLogSelect;

function getPhilippineDateRange(dateFrom?: string, dateTo?: string) {
  return {
    gte: dateFrom ? new Date(`${dateFrom}T00:00:00.000+08:00`) : undefined,
    lte: dateTo ? new Date(`${dateTo}T23:59:59.999+08:00`) : undefined,
  };
}

function getAuditLogListWhere(
  filters: AuditLogListFilters,
): Prisma.AuditLogWhereInput {
  const searchTerms = filters.search?.split(/\s+/).filter(Boolean) ?? [];
  const createdAt = getPhilippineDateRange(filters.dateFrom, filters.dateTo);

  return {
    module: filters.module,
    action: filters.action,
    userId: filters.actorId,
    createdAt:
      createdAt.gte || createdAt.lte
        ? createdAt
        : undefined,
    AND: searchTerms.map((term) => ({
      OR: [
        { module: { contains: term, mode: "insensitive" } },
        { action: { contains: term, mode: "insensitive" } },
        { recordId: { contains: term, mode: "insensitive" } },
        { recordName: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
        {
          user: {
            is: {
              OR: [
                { firstName: { contains: term, mode: "insensitive" } },
                { middleName: { contains: term, mode: "insensitive" } },
                { lastName: { contains: term, mode: "insensitive" } },
                { username: { contains: term, mode: "insensitive" } },
                { employeeNumber: { contains: term, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    })),
  };
}

export async function createAuditLog(data: Prisma.AuditLogCreateInput) {
  return prisma.auditLog.create({
    data,
  });
}

export async function createAuditLogs(
  data: Prisma.AuditLogCreateManyInput[],
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).auditLog.createMany({
    data,
  });
}

export async function countAuditLogs(filters: AuditLogListFilters) {
  return prisma.auditLog.count({ where: getAuditLogListWhere(filters) });
}

export async function findAuditLogs(
  filters: AuditLogListFilters,
  pagination: { skip: number; take: number },
  orderBy: Prisma.AuditLogOrderByWithRelationInput[],
) {
  return prisma.auditLog.findMany({
    where: getAuditLogListWhere(filters),
    select: auditLogListSelect,
    orderBy,
    skip: pagination.skip,
    take: pagination.take,
  });
}

export async function findAuditLogById(id: string) {
  return prisma.auditLog.findUnique({
    where: { id },
    select: auditLogDetailSelect,
  });
}

export async function findAuditLogFilterOptionValues() {
  return Promise.all([
    prisma.auditLog.findMany({
      distinct: ["module"],
      select: { module: true },
      orderBy: { module: "asc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["userId"],
      select: {
        user: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            username: true,
          },
        },
      },
    }),
  ]);
}
