import type { Prisma } from "../../app/generated/prisma/client";

const FINALIZATION_TRIGGER = "CurriculumFinalization_enforce_lifecycle_trigger";
const CONTEXT_TRIGGER = "SubjectOfferingShsContext_enforce_curriculum_lock_trigger";
const POLICY_TRIGGER = "ShsElectiveEnrollmentPolicy_enforce_curriculum_lock_trigger";

export async function makeLegacyActiveCurriculumConfigurable(
  academicYearId: string,
  transaction: Prisma.TransactionClient,
  resetGrade11Contexts = false,
) {
  await transaction.$executeRawUnsafe(
    `ALTER TABLE "CurriculumFinalization" DISABLE TRIGGER "${FINALIZATION_TRIGGER}"`,
  );
  await transaction.curriculumFinalization.deleteMany({ where: { academicYearId } });
  await transaction.$executeRawUnsafe(
    `ALTER TABLE "CurriculumFinalization" ENABLE TRIGGER "${FINALIZATION_TRIGGER}"`,
  );

  if (!resetGrade11Contexts) return;

  await transaction.$executeRawUnsafe(
    `ALTER TABLE "SubjectOfferingShsContext" DISABLE TRIGGER "${CONTEXT_TRIGGER}"`,
  );
  await transaction.subjectOfferingShsContext.updateMany({
    where: {
      sourceReference: { contains: "deped.gov.ph" },
      subjectOffering: {
        academicYearId,
        gradeLevel: "11",
        deletedAt: null,
        studentSubjectEnrollments: { none: {} },
      },
    },
    data: {
      curriculumStatus: "PROVISIONAL_DEPED",
      approvalReference: null,
      approvedById: null,
      approvedAt: null,
    },
  });
  await transaction.$executeRawUnsafe(
    `ALTER TABLE "SubjectOfferingShsContext" ENABLE TRIGGER "${CONTEXT_TRIGGER}"`,
  );
}

export async function createLegacyPolicyFixture(
  data: Prisma.ShsElectiveEnrollmentPolicyUncheckedCreateInput,
  transaction: Prisma.TransactionClient,
) {
  await transaction.$executeRawUnsafe(
    `ALTER TABLE "ShsElectiveEnrollmentPolicy" DISABLE TRIGGER "${POLICY_TRIGGER}"`,
  );
  const policy = await transaction.shsElectiveEnrollmentPolicy.create({ data });
  await transaction.$executeRawUnsafe(
    `ALTER TABLE "ShsElectiveEnrollmentPolicy" ENABLE TRIGGER "${POLICY_TRIGGER}"`,
  );
  return policy;
}
