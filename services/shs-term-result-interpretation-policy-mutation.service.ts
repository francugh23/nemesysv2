import { Prisma } from "@/app/generated/prisma/client";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  createShsTermResultInterpretationPolicyDraft,
  findShsTermResultInterpretationPolicy,
  lockAcademicYearForShsTermResultInterpretationPolicy,
  lockShsTermResultInterpretationPolicy,
  publishShsTermResultInterpretationPolicy,
  updateShsTermResultInterpretationPolicyDraft,
} from "@/repositories/shs-term-result-interpretation-policy.repository";
import type {
  PublishShsTermResultInterpretationPolicyInput,
  SaveShsTermResultInterpretationPolicyDraftInput,
} from "@/schemas";

export class ShsTermResultInterpretationPolicyError extends Error {}

function serializePolicy<T extends { passingThreshold: Prisma.Decimal }>(policy: T) {
  return { ...policy, passingThreshold: policy.passingThreshold.toNumber() };
}

async function lockActiveAcademicYear(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
) {
  const academicYear = await lockAcademicYearForShsTermResultInterpretationPolicy(
    academicYearId,
    transaction,
  );
  if (!academicYear) throw new ShsTermResultInterpretationPolicyError("Academic year not found.");
  if (academicYear.status !== "ACTIVE") {
    throw new ShsTermResultInterpretationPolicyError(
      "SHS Term Result interpretation policies may be changed only while the Academic Year is active.",
    );
  }
  return academicYear;
}

export async function saveShsTermResultInterpretationPolicyDraftInTransaction(
  values: SaveShsTermResultInterpretationPolicyDraftInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  const academicYear = await lockActiveAcademicYear(values.academicYearId, transaction);
  await lockShsTermResultInterpretationPolicy(values.academicYearId, transaction);
  const existing = await findShsTermResultInterpretationPolicy(values.academicYearId, transaction);
  if (existing?.status === "PUBLISHED") {
    throw new ShsTermResultInterpretationPolicyError("Published interpretation policies are immutable.");
  }

  let policy;
  if (existing) {
    const updated = await updateShsTermResultInterpretationPolicyDraft(
      existing.id,
      values,
      transaction,
    );
    if (updated.count !== 1) {
      throw new ShsTermResultInterpretationPolicyError("The draft policy changed. Refresh and try again.");
    }
    policy = await findShsTermResultInterpretationPolicy(values.academicYearId, transaction);
  } else {
    policy = await createShsTermResultInterpretationPolicyDraft(
      { ...values, actorId },
      transaction,
    );
  }
  if (!policy) throw new ShsTermResultInterpretationPolicyError("Interpretation policy not found.");

  await createAuditLogs([{
    userId: actorId,
    action: existing ? "UPDATE" : "CREATE",
    module: "ShsTermResultInterpretationPolicy",
    recordId: policy.id,
    recordName: academicYear.label,
    description: existing
      ? "Updated a draft SHS Term Result interpretation policy."
      : "Created a draft SHS Term Result interpretation policy.",
    metadata: {
      academicYearId: policy.academicYearId,
      passingThreshold: policy.passingThreshold.toNumber(),
      sourceReference: policy.sourceReference,
      status: policy.status,
    },
  }], transaction);

  return serializePolicy(policy);
}

export async function publishShsTermResultInterpretationPolicyInTransaction(
  values: PublishShsTermResultInterpretationPolicyInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
  clock: () => Date = () => new Date(),
) {
  const academicYear = await lockActiveAcademicYear(values.academicYearId, transaction);
  await lockShsTermResultInterpretationPolicy(values.academicYearId, transaction);
  const existing = await findShsTermResultInterpretationPolicy(values.academicYearId, transaction);
  if (!existing || existing.id !== values.policyId) {
    throw new ShsTermResultInterpretationPolicyError("Draft interpretation policy not found.");
  }
  if (existing.status === "PUBLISHED") {
    throw new ShsTermResultInterpretationPolicyError("Published interpretation policies are immutable.");
  }

  const publishedAt = clock();
  const updated = await publishShsTermResultInterpretationPolicy(
    existing.id,
    actorId,
    publishedAt,
    transaction,
  );
  if (updated.count !== 1) {
    throw new ShsTermResultInterpretationPolicyError("The draft policy changed. Refresh and try again.");
  }
  const policy = await findShsTermResultInterpretationPolicy(values.academicYearId, transaction);
  if (!policy) throw new ShsTermResultInterpretationPolicyError("Interpretation policy not found.");

  await createAuditLogs([{
    userId: actorId,
    action: "UPDATE",
    module: "ShsTermResultInterpretationPolicy",
    recordId: policy.id,
    recordName: academicYear.label,
    description: "Published an immutable SHS Term Result interpretation policy.",
    metadata: {
      academicYearId: policy.academicYearId,
      previousStatus: "DRAFT",
      status: "PUBLISHED",
      passingThreshold: policy.passingThreshold.toNumber(),
      sourceReference: policy.sourceReference,
    },
  }], transaction);

  return serializePolicy(policy);
}
