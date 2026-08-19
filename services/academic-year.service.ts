import {
  Prisma,
  type AcademicYearStatus,
} from "@/app/generated/prisma/client";
import {
  Permissions,
  requirePermission,
} from "@/lib/authorization";
import { hasPermission } from "@/lib/permissions";
import { hasThreeChronologicallyOrderedTerms } from "@/lib/academic-term";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import {
  countAcademicYears,
  createAcademicYear,
  findAcademicYearById,
  findAcademicYearConfigurationById,
  findAcademicYears,
  findAcademicYearStatusOptionValues,
  findOverlappingAcademicYear,
  lockAcademicYearForAcademicTerms,
  transitionAcademicYearStatus,
  updateDraftAcademicYear,
} from "@/repositories/academic-year.repository";
import { findAcademicTermsByAcademicYear } from "@/repositories/academic-term.repository";
import {
  countOfferings,
  findAcademicYearOfferingGradeCounts,
} from "@/repositories/subject-offering.repository";
import { findShsElectiveEnrollmentPolicies } from "@/repositories/shs-elective-enrollment-policy.repository";
import { findShsTermResultInterpretationPolicy } from "@/repositories/shs-term-result-interpretation-policy.repository";
import { buildAcademicYearConfigurationSummary } from "@/services/academic-year-configuration-summary.service";
import type {
  AcademicYearFilterOptions,
  AcademicYearPage,
  AcademicYearTableQuery,
  CreateAcademicYearInput,
  UpdateAcademicYearInput,
} from "@/schemas";

export type AcademicYearServiceErrorCode =
  | "INVALID_QUERY"
  | "NOT_FOUND"
  | "INVALID_STATUS"
  | "NO_CHANGES"
  | "OVERLAP"
  | "CONFLICT";

export class AcademicYearServiceError extends Error {
  constructor(
    message: string,
    readonly code: AcademicYearServiceErrorCode,
  ) {
    super(message);
    this.name = "AcademicYearServiceError";
  }
}

type AuditChanges = Record<string, { from: string; to: string }>;

function getAcademicYearOrderBy(
  query: AcademicYearTableQuery,
): Prisma.AcademicYearOrderByWithRelationInput[] {
  const direction = query.direction ?? "asc";

  switch (query.sort) {
    case "label":
      return [{ label: direction }, { id: "asc" }];
    case "endDate":
      return [{ endDate: direction }, { id: "asc" }];
    case "status":
      return [{ status: direction }, { id: "asc" }];
    case "startDate":
      return [{ startDate: direction }, { id: "asc" }];
    default:
      return [{ startDate: "desc" }, { id: "asc" }];
  }
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function normalizeAcademicYearValues(
  values: CreateAcademicYearInput | UpdateAcademicYearInput,
) {
  const startYear = Number(values.startDate.slice(0, 4));

  return {
    label: `${startYear}-${startYear + 1}`,
    startDate: toDate(values.startDate),
    endDate: toDate(values.endDate),
  };
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function rethrowAcademicYearConstraint(error: unknown): never {
  if (error instanceof AcademicYearServiceError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AcademicYearServiceError(
        "The academic year conflicts with an existing academic year.",
        "CONFLICT",
      );
    }

    if (error.code === "P2004" || error.message.includes("23P01")) {
      throw new AcademicYearServiceError(
        "Academic year dates overlap an existing academic year.",
        "OVERLAP",
      );
    }

    if (error.code === "P2034") {
      throw new AcademicYearServiceError(
        "Academic year changed concurrently. Refresh and try again.",
        "CONFLICT",
      );
    }
  }

  throw error;
}

async function assertNoOverlap(
  values: ReturnType<typeof normalizeAcademicYearValues>,
  transaction: Prisma.TransactionClient,
  excludeId?: string,
) {
  const overlap = await findOverlappingAcademicYear(
    values.startDate,
    values.endDate,
    excludeId,
    transaction,
  );

  if (overlap) {
    throw new AcademicYearServiceError(
      `Academic year dates overlap ${overlap.label}.`,
      "OVERLAP",
    );
  }
}

export async function getAcademicYears(
  query: AcademicYearTableQuery,
): Promise<AcademicYearPage> {
  await requirePermission(Permissions.ACADEMIC_YEARS);

  const filters = { search: query.q, status: query.status };
  const totalCount = await countAcademicYears(filters);
  const pageCount = Math.ceil(totalCount / query.pageSize);
  const page = Math.min(query.page, Math.max(pageCount, 1));
  const items = await findAcademicYears(
    filters,
    { skip: (page - 1) * query.pageSize, take: query.pageSize },
    getAcademicYearOrderBy(query),
  );

  return {
    items,
    totalCount,
    page,
    pageSize: query.pageSize,
    pageCount,
  };
}

export async function getAcademicYearFilterOptions(): Promise<AcademicYearFilterOptions> {
  await requirePermission(Permissions.ACADEMIC_YEARS);

  const statuses = await findAcademicYearStatusOptionValues();

  return { statuses: statuses.map((value) => value.status) };
}

export async function getAcademicYearConfigurationSummaryService(
  academicYearId: string,
) {
  const session = await requirePermission(Permissions.ACADEMIC_YEARS);
  await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);

  const includeResultPolicy = hasPermission(
    session.user.role,
    Permissions.GRADES,
  );

  return prisma.$transaction(
    async (transaction) => {
      const academicYear = await findAcademicYearConfigurationById(
        academicYearId,
        transaction,
      );

      if (!academicYear) {
        throw new AcademicYearServiceError("Academic year not found.", "NOT_FOUND");
      }

      const activeOfferingCount = await countOfferings(
        { academicYearId },
        transaction,
      );
      const gradeCounts = await findAcademicYearOfferingGradeCounts(
        academicYearId,
        transaction,
      );
      const provisionalShsOfferingCount = await countOfferings(
        { academicYearId, curriculumStatus: "PROVISIONAL_DEPED" },
        transaction,
      );
      const schoolApprovedShsOfferingCount = await countOfferings(
        { academicYearId, curriculumStatus: "SCHOOL_APPROVED" },
        transaction,
      );
      const electivePolicies = await findShsElectiveEnrollmentPolicies(
        academicYearId,
        transaction,
      );
      const resultPolicy = includeResultPolicy
        ? await findShsTermResultInterpretationPolicy(
            academicYearId,
            transaction,
          )
        : undefined;

      return buildAcademicYearConfigurationSummary({
        academicYear,
        curriculum: {
          activeOfferingCount,
          gradeCounts: gradeCounts
            .map(({ gradeLevel, _count }) => ({
              gradeLevel,
              count: _count._all,
            }))
            .sort(
              (left, right) =>
                Number(left.gradeLevel) - Number(right.gradeLevel),
            ),
          provisionalShsOfferingCount,
          schoolApprovedShsOfferingCount,
        },
        electivePolicies,
        includeResultPolicy,
        resultPolicy,
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function createAcademicYearService(
  input: CreateAcademicYearInput,
) {
  const session = await requirePermission(Permissions.ACADEMIC_YEARS);
  const values = normalizeAcademicYearValues(input);

  try {
    return await prisma.$transaction(async (transaction) => {
      await assertNoOverlap(values, transaction);

      const academicYear = await createAcademicYear(
        {
          ...values,
          status: "DRAFT",
          createdById: session.user.id,
        },
        transaction,
      );

      await createAuditLogs(
        [{
          userId: session.user.id,
          action: "CREATE",
          module: "AcademicYear",
          recordId: academicYear.id,
          recordName: academicYear.label,
          description: "Created draft academic year.",
        }],
        transaction,
      );

      return academicYear;
    });
  } catch (error) {
    rethrowAcademicYearConstraint(error);
  }
}

export async function updateAcademicYearService(
  id: string,
  input: UpdateAcademicYearInput,
) {
  const session = await requirePermission(Permissions.ACADEMIC_YEARS);
  const values = normalizeAcademicYearValues(input);

  try {
    return await prisma.$transaction(async (transaction) => {
      const academicYear = await findAcademicYearById(id, transaction);

      if (!academicYear) {
        throw new AcademicYearServiceError("Academic year not found.", "NOT_FOUND");
      }

      if (academicYear.status !== "DRAFT") {
        throw new AcademicYearServiceError(
          "Only draft academic years can be updated.",
          "INVALID_STATUS",
        );
      }

      await assertNoOverlap(values, transaction, academicYear.id);

      const changes: AuditChanges = {};

      if (academicYear.label !== values.label) {
        changes.label = { from: academicYear.label, to: values.label };
      }

      if (academicYear.startDate.getTime() !== values.startDate.getTime()) {
        changes.startDate = {
          from: formatDate(academicYear.startDate),
          to: formatDate(values.startDate),
        };
      }

      if (academicYear.endDate.getTime() !== values.endDate.getTime()) {
        changes.endDate = {
          from: formatDate(academicYear.endDate),
          to: formatDate(values.endDate),
        };
      }

      if (Object.keys(changes).length === 0) {
        throw new AcademicYearServiceError(
          "No changes to save.",
          "NO_CHANGES",
        );
      }

      const update = await updateDraftAcademicYear(
        academicYear.id,
        values,
        transaction,
      );

      if (update.count !== 1) {
        throw new AcademicYearServiceError(
          "Academic year is no longer a draft.",
          "INVALID_STATUS",
        );
      }

      await createAuditLogs(
        [{
          userId: session.user.id,
          action: "UPDATE",
          module: "AcademicYear",
          recordId: academicYear.id,
          recordName: values.label,
          description: "Updated draft academic year.",
          metadata: Object.keys(changes).length > 0 ? { changes } : undefined,
        }],
        transaction,
      );

      return academicYear.id;
    });
  } catch (error) {
    rethrowAcademicYearConstraint(error);
  }
}

async function transitionAcademicYearService(
  id: string,
  allowedStatuses: AcademicYearStatus[],
  nextStatus: AcademicYearStatus,
  action: "ACTIVATE" | "LOCK" | "ARCHIVE",
) {
  const session = await requirePermission(Permissions.ACADEMIC_YEARS);

  const operation = async (transaction: Prisma.TransactionClient) => {
    const academicYear =
      action === "ACTIVATE"
        ? await lockAcademicYearForAcademicTerms(id, transaction, "UPDATE")
        : await findAcademicYearById(id, transaction);

    if (!academicYear) {
      throw new AcademicYearServiceError("Academic year not found.", "NOT_FOUND");
    }

    if (!allowedStatuses.includes(academicYear.status)) {
      const transitionVerb = {
        ACTIVATE: "activated",
        LOCK: "locked",
        ARCHIVE: "archived",
      }[action];

      throw new AcademicYearServiceError(
        `Academic year cannot be ${transitionVerb} from ${academicYear.status}.`,
        "INVALID_STATUS",
      );
    }

    if (action === "ACTIVATE") {
      const terms = await findAcademicTermsByAcademicYear(
        academicYear.id,
        transaction,
      );

      if (terms.length !== 3) {
        throw new AcademicYearServiceError(
          "Academic year must have exactly three terms before activation.",
          "INVALID_STATUS",
        );
      }

      if (!hasThreeChronologicallyOrderedTerms(terms)) {
        throw new AcademicYearServiceError(
          "Academic term positions must be in chronological order.",
          "INVALID_STATUS",
        );
      }
    }

    const update = await transitionAcademicYearStatus(
      academicYear.id,
      allowedStatuses,
      nextStatus,
      transaction,
    );

    if (update.count !== 1) {
      throw new AcademicYearServiceError(
        "Academic year status changed. Refresh and try again.",
        "CONFLICT",
      );
    }

    const actionVerb = {
      ACTIVATE: "Activated",
      LOCK: "Locked",
      ARCHIVE: "Archived",
    }[action];

    await createAuditLogs(
      [{
        userId: session.user.id,
        action,
        module: "AcademicYear",
        recordId: academicYear.id,
        recordName: academicYear.label,
        description: `${actionVerb} academic year.`,
        metadata: {
          changes: {
            status: { from: academicYear.status, to: nextStatus },
          },
        },
      }],
      transaction,
    );

    return academicYear.id;
  };

  try {
    return action === "ACTIVATE"
      ? await prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        })
      : await prisma.$transaction(operation);
  } catch (error) {
    rethrowAcademicYearConstraint(error);
  }
}

export async function activateAcademicYearService(id: string) {
  return transitionAcademicYearService(id, ["DRAFT"], "ACTIVE", "ACTIVATE");
}

export async function lockAcademicYearService(id: string) {
  return transitionAcademicYearService(id, ["ACTIVE"], "LOCKED", "LOCK");
}

export async function archiveAcademicYearService(id: string) {
  return transitionAcademicYearService(
    id,
    ["DRAFT", "LOCKED"],
    "ARCHIVED",
    "ARCHIVE",
  );
}
