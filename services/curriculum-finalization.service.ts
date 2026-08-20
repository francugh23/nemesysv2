import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  countPendingShsOfferings,
  createCurriculumFinalization,
  lockAcademicYearsForCurriculumMutation,
} from "@/repositories/curriculum-finalization.repository";

export class CurriculumFinalizationServiceError extends Error {}

export async function finalizeCurriculumService(academicYearId: string) {
  const session = await requirePermission(Permissions.SUBJECTS);

  try {
    return await prisma.$transaction(async (transaction) => {
      const [academicYear] = await lockAcademicYearsForCurriculumMutation(
        [academicYearId],
        transaction,
      );
      if (!academicYear) {
        throw new CurriculumFinalizationServiceError("Academic Year not found.");
      }
      if (academicYear.status !== "ACTIVE") {
        throw new CurriculumFinalizationServiceError(
          "Curriculum may be finalized only for an active Academic Year.",
        );
      }
      if (academicYear.curriculumFinalized) {
        throw new CurriculumFinalizationServiceError(
          "Curriculum is already finalized for this Academic Year.",
        );
      }

      const pendingCount = await countPendingShsOfferings(
        academicYear.id,
        transaction,
      );
      if (pendingCount > 0) {
        throw new CurriculumFinalizationServiceError(
          `${pendingCount} active SHS Offering${pendingCount === 1 ? " is" : "s are"} missing SHS context or Pending School Approval. Complete, approve, or archive ${pendingCount === 1 ? "it" : "them"} before finalization.`,
        );
      }

      const finalizedAt = new Date();
      const finalization = await createCurriculumFinalization(
        {
          academicYearId: academicYear.id,
          finalizedById: session.user.id,
          finalizedAt,
        },
        transaction,
      );
      await createAuditLogs([{
        userId: session.user.id,
        action: "FINALIZE",
        module: "CurriculumFinalization",
        recordId: finalization.id,
        recordName: academicYear.label,
        description: "Finalized Curriculum configuration without changing the Academic Year lifecycle.",
        metadata: {
          academicYearId: academicYear.id,
          academicYearStatus: academicYear.status,
          finalizedAt: finalizedAt.toISOString(),
        },
      }], transaction);

      return finalization;
    });
  } catch (error) {
    if (error instanceof CurriculumFinalizationServiceError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new CurriculumFinalizationServiceError(
        "Curriculum is already finalized for this Academic Year.",
      );
    }
    throw error;
  }
}
