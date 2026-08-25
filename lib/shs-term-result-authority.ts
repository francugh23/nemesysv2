import { Prisma } from "@/app/generated/prisma/client";

export function resolveShsTermResultAuthority(result: {
  status: "DRAFT" | "FINALIZED";
  finalResult: Prisma.Decimal | null;
  revisions: Array<{ id: string; sequence: number; revisedFinalResult: Prisma.Decimal; revisedAt: Date }>;
}) {
  const revisions = [...result.revisions].sort((left, right) => left.sequence - right.sequence);
  const latest = revisions.at(-1) ?? null;
  return {
    originalFinalResult: result.finalResult,
    authoritativeFinalResult: latest?.revisedFinalResult ?? result.finalResult,
    authoritativeSource: latest ? "REVISION" as const : "ORIGINAL" as const,
    latestRevisionId: latest?.id ?? null,
    latestRevisionSequence: latest?.sequence ?? 0,
    latestRevisionAt: latest?.revisedAt ?? null,
  };
}
