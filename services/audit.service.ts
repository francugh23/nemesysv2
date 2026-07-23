import { auth } from "@/auth";
import { Prisma } from "@/app/generated/prisma/client";
import { createAuditLog as createAuditLogRepository } from "@/repositories/audit.repository";

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