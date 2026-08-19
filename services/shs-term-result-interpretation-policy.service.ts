import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { findShsTermResultInterpretationPolicy } from "@/repositories/shs-term-result-interpretation-policy.repository";
import type {
  PublishShsTermResultInterpretationPolicyInput,
  SaveShsTermResultInterpretationPolicyDraftInput,
  ShsTermResultInterpretationPolicyReadInput,
} from "@/schemas";
import {
  publishShsTermResultInterpretationPolicyInTransaction,
  saveShsTermResultInterpretationPolicyDraftInTransaction,
  ShsTermResultInterpretationPolicyError,
} from "@/services/shs-term-result-interpretation-policy-mutation.service";

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
  throw new ShsTermResultInterpretationPolicyError("Interpretation policy operation could not be completed.");
}

export async function getShsTermResultInterpretationPolicyService(
  values: ShsTermResultInterpretationPolicyReadInput,
) {
  await requirePermission(Permissions.GRADES);
  const policy = await findShsTermResultInterpretationPolicy(values.academicYearId);
  return policy
    ? { ...policy, passingThreshold: policy.passingThreshold.toNumber() }
    : null;
}

export async function saveShsTermResultInterpretationPolicyDraftService(
  values: SaveShsTermResultInterpretationPolicyDraftInput,
) {
  const session = await requirePermission(Permissions.GRADES);
  try {
    return await runSerializableMutation((transaction) =>
      saveShsTermResultInterpretationPolicyDraftInTransaction(values, session.user.id, transaction));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ShsTermResultInterpretationPolicyError(
        "An interpretation policy already exists for this Academic Year.",
      );
    }
    throw error;
  }
}

export async function publishShsTermResultInterpretationPolicyService(
  values: PublishShsTermResultInterpretationPolicyInput,
) {
  const session = await requirePermission(Permissions.GRADES);
  return runSerializableMutation((transaction) =>
    publishShsTermResultInterpretationPolicyInTransaction(values, session.user.id, transaction));
}
