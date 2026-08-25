import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import type { CorrectShsStudentParticipationInput } from "@/schemas";
import {
  correctShsStudentParticipationInTransaction,
  ShsStudentParticipationCorrectionError,
} from "@/services/shs-student-participation-correction-mutation.service";

export { ShsStudentParticipationCorrectionError } from "@/services/shs-student-participation-correction-mutation.service";

function retryable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; meta?: { code?: unknown }; cause?: unknown };
  return candidate.code === "40001" || candidate.code === "40P01" || candidate.meta?.code === "40001" || candidate.meta?.code === "40P01" || retryable(candidate.cause);
}

export async function correctShsStudentParticipationService(enrollmentId: string, values: CorrectShsStudentParticipationInput) {
  const session = await requirePermission(Permissions.STUDENT_CORRECTIONS);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        (transaction) => correctShsStudentParticipationInTransaction(enrollmentId, values, session.user.id, transaction),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (retryable(error) && attempt < 3) continue;
      if (error instanceof ShsStudentParticipationCorrectionError) throw error;
      if (retryable(error)) throw new ShsStudentParticipationCorrectionError("SHS participation changed concurrently. Refresh and try again.");
      throw new ShsStudentParticipationCorrectionError("Controlled SHS participation correction could not be completed.");
    }
  }
  throw new ShsStudentParticipationCorrectionError("Controlled SHS participation correction could not be completed.");
}
