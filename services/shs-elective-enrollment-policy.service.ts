import { Prisma } from "@/app/generated/prisma/client";
import { Permissions, requirePermission } from "@/lib/authorization";
import prisma from "@/lib/prisma";
import { createAuditLogs } from "@/repositories/audit.repository";
import { lockAcademicYearsForCurriculumMutation } from "@/repositories/curriculum-finalization.repository";
import {
  createShsElectiveEnrollmentPolicy,
  findAcademicTermForShsElectiveEnrollmentPolicy,
  findShsElectiveEnrollmentPolicies,
  findShsElectiveEnrollmentPolicy,
  hasShsParticipationForPolicyScope,
  lockShsElectiveEnrollmentPolicy,
  lockShsElectiveEnrollmentPolicyScope,
  updateShsElectiveEnrollmentPolicy,
} from "@/repositories/shs-elective-enrollment-policy.repository";
import type {
  CreateShsElectiveEnrollmentPolicyInput,
  ShsElectiveEnrollmentPolicyListInput,
  UpdateShsElectiveEnrollmentPolicyInput,
} from "@/schemas";

export class ShsElectiveEnrollmentPolicyServiceError extends Error {}

async function validatePolicyTerm(
  values: CreateShsElectiveEnrollmentPolicyInput,
  transaction: Prisma.TransactionClient,
  lockedAcademicYear?: { status: string; curriculumFinalized: boolean },
) {
  const academicYear = lockedAcademicYear
    ?? await lockShsElectiveEnrollmentPolicyScope(values.academicYearId, transaction);
  if (!academicYear) {
    throw new ShsElectiveEnrollmentPolicyServiceError("Academic year not found.");
  }
  if (academicYear.status === "LOCKED" || academicYear.status === "ARCHIVED") {
    throw new ShsElectiveEnrollmentPolicyServiceError("Elective policies are read-only for locked or archived academic years.");
  }
  if (academicYear.curriculumFinalized) {
    throw new ShsElectiveEnrollmentPolicyServiceError("Curriculum is finalized and elective policies are read-only.");
  }
  const term = await findAcademicTermForShsElectiveEnrollmentPolicy(
    values.academicTermId,
    transaction,
  );
  if (!term || term.academicYearId !== values.academicYearId) {
    throw new ShsElectiveEnrollmentPolicyServiceError(
      "Academic term must belong to the selected academic year.",
    );
  }
  return term;
}

export async function createShsElectiveEnrollmentPolicyInTransaction(
  values: CreateShsElectiveEnrollmentPolicyInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  const term = await validatePolicyTerm(values, transaction);
  if (await hasShsParticipationForPolicyScope(values.academicYearId, values.academicTermId, values.gradeLevel, transaction)) {
    throw new ShsElectiveEnrollmentPolicyServiceError("This elective-policy scope is locked by SHS Student Participation.");
  }
  const policy = await createShsElectiveEnrollmentPolicy(
    { ...values, createdById: actorId },
    transaction,
  );
  await createAuditLogs(
    [{
      userId: actorId,
      action: "CREATE",
      module: "ShsElectiveEnrollmentPolicy",
      recordId: policy.id,
      recordName: `Grade ${policy.gradeLevel} - Term ${term.position}`,
      description: "Created SHS elective enrollment policy.",
      metadata: {
        academicYearId: policy.academicYearId,
        academicTermId: policy.academicTermId,
        gradeLevel: policy.gradeLevel,
        minimumElectives: policy.minimumElectives,
        maximumElectives: policy.maximumElectives,
      },
    }],
    transaction,
  );
  return policy;
}

export async function updateShsElectiveEnrollmentPolicyInTransaction(
  id: string,
  values: UpdateShsElectiveEnrollmentPolicyInput,
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  const reference = await findShsElectiveEnrollmentPolicy(id, transaction);
  if (!reference) {
    throw new ShsElectiveEnrollmentPolicyServiceError("Elective policy not found.");
  }
  const lockedYears = await lockAcademicYearsForCurriculumMutation(
    [reference.academicYearId, values.academicYearId],
    transaction,
  );
  if (lockedYears.length !== new Set([reference.academicYearId, values.academicYearId]).size) {
    throw new ShsElectiveEnrollmentPolicyServiceError("Academic year not found.");
  }
  if (lockedYears.some(({ status }) => status === "LOCKED" || status === "ARCHIVED")) {
    throw new ShsElectiveEnrollmentPolicyServiceError("Elective policies are read-only for locked or archived academic years.");
  }
  if (lockedYears.some(({ curriculumFinalized }) => curriculumFinalized)) {
    throw new ShsElectiveEnrollmentPolicyServiceError("Curriculum is finalized and elective policies are read-only.");
  }
  if (!(await lockShsElectiveEnrollmentPolicy(id, transaction))) {
    throw new ShsElectiveEnrollmentPolicyServiceError("Elective policy not found.");
  }
  const previous = await findShsElectiveEnrollmentPolicy(id, transaction);
  if (!previous) {
    throw new ShsElectiveEnrollmentPolicyServiceError("Elective policy not found.");
  }
  const targetYear = lockedYears.find(({ id: academicYearId }) => academicYearId === values.academicYearId)!;
  const term = await validatePolicyTerm(values, transaction, targetYear);
  if (
    await hasShsParticipationForPolicyScope(previous.academicYearId, previous.academicTermId, previous.gradeLevel, transaction)
    || await hasShsParticipationForPolicyScope(values.academicYearId, values.academicTermId, values.gradeLevel, transaction)
  ) {
    throw new ShsElectiveEnrollmentPolicyServiceError("This elective-policy scope is locked by SHS Student Participation.");
  }
  const policy = await updateShsElectiveEnrollmentPolicy(
    id,
    values,
    transaction,
  );
  await createAuditLogs(
    [{
      userId: actorId,
      action: "UPDATE",
      module: "ShsElectiveEnrollmentPolicy",
      recordId: policy.id,
      recordName: `Grade ${policy.gradeLevel} - Term ${term.position}`,
      description: "Updated SHS elective enrollment policy.",
      metadata: {
        changes: {
          academicYearId: { from: previous.academicYearId, to: policy.academicYearId },
          academicTermId: { from: previous.academicTermId, to: policy.academicTermId },
          gradeLevel: { from: previous.gradeLevel, to: policy.gradeLevel },
          minimumElectives: { from: previous.minimumElectives, to: policy.minimumElectives },
          maximumElectives: { from: previous.maximumElectives, to: policy.maximumElectives },
        },
      },
    }],
    transaction,
  );
  return policy;
}

function rethrowPolicyConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ShsElectiveEnrollmentPolicyServiceError(
      "An elective policy already exists for this academic year, term, and grade.",
    );
  }
  throw error;
}

export async function getShsElectiveEnrollmentPolicies(
  query: ShsElectiveEnrollmentPolicyListInput,
) {
  await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);
  return findShsElectiveEnrollmentPolicies(query.academicYearId);
}

export async function createShsElectiveEnrollmentPolicyService(
  values: CreateShsElectiveEnrollmentPolicyInput,
) {
  const session = await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);
  try {
    return await prisma.$transaction((transaction) =>
      createShsElectiveEnrollmentPolicyInTransaction(
        values,
        session.user.id,
        transaction,
      ),
    );
  } catch (error) {
    rethrowPolicyConflict(error);
  }
}

export async function updateShsElectiveEnrollmentPolicyService(
  id: string,
  values: UpdateShsElectiveEnrollmentPolicyInput,
) {
  const session = await requirePermission(Permissions.SHS_CURRICULUM_APPROVAL);
  try {
    return await prisma.$transaction((transaction) =>
      updateShsElectiveEnrollmentPolicyInTransaction(
        id,
        values,
        session.user.id,
        transaction,
      ),
    );
  } catch (error) {
    rethrowPolicyConflict(error);
  }
}
