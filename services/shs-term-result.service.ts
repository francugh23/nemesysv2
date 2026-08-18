import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import type {
  FinalizeShsTermResultInput,
  SaveShsTermResultDraftInput,
} from "@/schemas";
import {
  finalizeShsTermResultInTransaction,
  saveShsTermResultDraftInTransaction,
  ShsTermResultError,
} from "@/services/shs-term-result-mutation.service";

const MAX_TRANSACTION_ATTEMPTS = 3;

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; meta?: { code?: unknown }; cause?: unknown };
  return candidate.code === "40001" || candidate.code === "40P01" || candidate.meta?.code === "40001" || candidate.meta?.code === "40P01" || isRetryableTransactionError(candidate.cause);
}

async function runSerializableMutation<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === MAX_TRANSACTION_ATTEMPTS) throw error;
    }
  }
  throw new ShsTermResultError("SHS Term Result operation could not be completed.");
}

export async function saveShsTermResultDraftService(values: SaveShsTermResultDraftInput) {
  const session = await requirePermission(Permissions.GRADES);
  return runSerializableMutation((transaction) =>
    saveShsTermResultDraftInTransaction(values, session.user.id, transaction),
  );
}

export async function finalizeShsTermResultService(values: FinalizeShsTermResultInput) {
  const session = await requirePermission(Permissions.GRADES);
  return runSerializableMutation((transaction) =>
    finalizeShsTermResultInTransaction(values, session.user.id, transaction),
  );
}
