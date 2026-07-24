import prisma from "@/lib/prisma";

import { Prisma } from "@/app/generated/prisma/client";

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

export async function findAuditLogs() {
  return prisma.auditLog.findMany({
    include: {
      user: {
        select: {
          name: true,
          username: true,
          role: true,
        },
      },
    },

    orderBy: {
      createdAt: "desc",
    },
  });
}
