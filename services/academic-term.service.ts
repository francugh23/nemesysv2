import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import { lockAcademicYearForAcademicTerms } from "@/repositories/academic-year.repository";
import {
  createAcademicTerm,
  deleteAcademicTerm,
  findAcademicTermById,
  findAcademicTermsByAcademicYear,
  findOverlappingAcademicTerm,
  updateAcademicTerm,
} from "@/repositories/academic-term.repository";
import type {
  CreateAcademicTermInput,
  UpdateAcademicTermInput,
} from "@/schemas";

export class AcademicTermServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcademicTermServiceError";
  }
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function normalizeValues(values: CreateAcademicTermInput | UpdateAcademicTermInput) {
  return {
    name: values.name.trim(),
    position: values.position,
    startDate: toDate(values.startDate),
    endDate: toDate(values.endDate),
  };
}

function assertDraftAcademicYear(academicYear: { status: string }) {
  if (academicYear.status !== "DRAFT") {
    throw new AcademicTermServiceError(
      "Academic terms can only be changed while their academic year is a draft.",
    );
  }
}

function assertContainedByAcademicYear(
  values: ReturnType<typeof normalizeValues>,
  academicYear: { startDate: Date; endDate: Date },
) {
  if (
    values.startDate < academicYear.startDate ||
    values.endDate > academicYear.endDate
  ) {
    throw new AcademicTermServiceError(
      "Term dates must fall within the academic year dates.",
    );
  }
}

async function assertNoOverlap(
  academicYearId: string,
  values: ReturnType<typeof normalizeValues>,
  transaction: Prisma.TransactionClient,
  excludeId?: string,
) {
  const overlap = await findOverlappingAcademicTerm(
    academicYearId,
    values.startDate,
    values.endDate,
    excludeId,
    transaction,
  );

  if (overlap) {
    throw new AcademicTermServiceError(
      `Term dates overlap ${overlap.name}.`,
    );
  }
}

function rethrowConstraint(error: unknown): never {
  if (error instanceof AcademicTermServiceError) throw error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AcademicTermServiceError(
        "A term with that position or name already exists for this academic year.",
      );
    }

    if (error.code === "P2004" || error.message.includes("23P01")) {
      throw new AcademicTermServiceError(
        "Term dates overlap an existing term.",
      );
    }
  }

  throw error;
}

export async function getAcademicTerms(academicYearId: string) {
  await requirePermission(Permissions.ACADEMIC_YEARS);
  return findAcademicTermsByAcademicYear(academicYearId);
}

export async function createAcademicTermService(
  academicYearId: string,
  input: CreateAcademicTermInput,
) {
  const session = await requirePermission(Permissions.ACADEMIC_YEARS);
  const values = normalizeValues(input);

  try {
    return await prisma.$transaction(async (transaction) => {
      const academicYear = await lockAcademicYearForAcademicTerms(
        academicYearId,
        transaction,
      );

      if (!academicYear) {
        throw new AcademicTermServiceError("Academic year not found.");
      }

      assertDraftAcademicYear(academicYear);
      assertContainedByAcademicYear(values, academicYear);
      await assertNoOverlap(academicYear.id, values, transaction);

      const term = await createAcademicTerm(
        { ...values, academicYearId: academicYear.id, createdById: session.user.id },
        transaction,
      );

      await createAuditLogs(
        [{
          userId: session.user.id,
          action: "CREATE",
          module: "AcademicTerm",
          recordId: term.id,
          recordName: `${academicYear.label} - ${term.name}`,
          description: "Created academic term.",
        }],
        transaction,
      );

      return term;
    });
  } catch (error) {
    rethrowConstraint(error);
  }
}

export async function updateAcademicTermService(
  id: string,
  input: UpdateAcademicTermInput,
) {
  const session = await requirePermission(Permissions.ACADEMIC_YEARS);
  const values = normalizeValues(input);

  try {
    return await prisma.$transaction(async (transaction) => {
      const term = await findAcademicTermById(id, transaction);

      if (!term) throw new AcademicTermServiceError("Academic term not found.");

      const academicYear = await lockAcademicYearForAcademicTerms(
        term.academicYearId,
        transaction,
      );

      if (!academicYear) {
        throw new AcademicTermServiceError("Academic year not found.");
      }

      assertDraftAcademicYear(academicYear);
      assertContainedByAcademicYear(values, academicYear);
      await assertNoOverlap(academicYear.id, values, transaction, term.id);

      const updated = await updateAcademicTerm(term.id, values, transaction);

      await createAuditLogs(
        [{
          userId: session.user.id,
          action: "UPDATE",
          module: "AcademicTerm",
          recordId: updated.id,
          recordName: `${academicYear.label} - ${updated.name}`,
          description: "Updated academic term.",
        }],
        transaction,
      );

      return updated;
    });
  } catch (error) {
    rethrowConstraint(error);
  }
}

export async function deleteAcademicTermService(id: string) {
  const session = await requirePermission(Permissions.ACADEMIC_YEARS);

  return prisma.$transaction(async (transaction) => {
    const term = await findAcademicTermById(id, transaction);

    if (!term) throw new AcademicTermServiceError("Academic term not found.");

    const academicYear = await lockAcademicYearForAcademicTerms(
      term.academicYearId,
      transaction,
    );

    if (!academicYear) throw new AcademicTermServiceError("Academic year not found.");

    assertDraftAcademicYear(academicYear);
    await deleteAcademicTerm(term.id, transaction);

    await createAuditLogs(
      [{
        userId: session.user.id,
        action: "DELETE",
        module: "AcademicTerm",
        recordId: term.id,
        recordName: `${academicYear.label} - ${term.name}`,
        description: "Removed draft academic term.",
      }],
      transaction,
    );

    return term.id;
  });
}
