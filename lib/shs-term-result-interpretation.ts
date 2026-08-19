import { Prisma } from "@/app/generated/prisma/client";

export function interpretFinalizedShsTermResult(
  result: { status: "DRAFT" | "FINALIZED"; finalResult: Prisma.Decimal | null },
  policy: {
    passingThreshold: Prisma.Decimal;
    status: "DRAFT" | "PUBLISHED";
  } | null,
) {
  if (
    result.status !== "FINALIZED" ||
    result.finalResult === null ||
    policy?.status !== "PUBLISHED"
  ) return null;
  return {
    outcome: result.finalResult.comparedTo(policy.passingThreshold) >= 0
      ? "PASSED" as const
      : "FAILED" as const,
    passingThreshold: policy.passingThreshold.toNumber(),
  };
}
