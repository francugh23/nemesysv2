import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

const studentSubjectEnrollmentSelect = {
  id: true,
  enrollmentId: true,
  subjectOfferingId: true,
  subjectCode: true,
  subjectDescription: true,
  gradeLevel: true,
  shsClassification: true,
  shsClusterCode: true,
  shsClusterName: true,
  shsCurriculumStatus: true,
  shsSourceReference: true,
  shsApprovalReference: true,
  status: true,
  replacedAt: true,
  createdAt: true,
  updatedAt: true,
  terms: {
    select: {
      academicTermId: true,
      academicTerm: {
        select: { name: true, position: true },
      },
    },
    orderBy: { academicTerm: { position: "asc" } },
  },
} satisfies Prisma.StudentSubjectEnrollmentSelect;

export async function findStudentSubjectEnrollments(
  query: { enrollmentId: string; status?: "ACTIVE" | "REPLACED" },
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).studentSubjectEnrollment.findMany({
    where: query,
    select: studentSubjectEnrollmentSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

export async function findActiveStudentSubjectEnrollmentByIdentity(
  enrollmentId: string,
  subjectOfferingId: string,
  transaction?: Prisma.TransactionClient,
) {
  return (transaction ?? prisma).studentSubjectEnrollment.findFirst({
    where: { enrollmentId, subjectOfferingId, status: "ACTIVE" },
    select: { id: true },
  });
}

export async function replaceActiveStudentSubjectEnrollments(
  enrollmentId: string,
  replacedAt: Date,
  transaction: Prisma.TransactionClient,
) {
  const studentSubjectEnrollments = await transaction.studentSubjectEnrollment.findMany({
    where: { enrollmentId, status: "ACTIVE" },
    select: {
      id: true,
      subjectOfferingId: true,
      subjectCode: true,
      subjectDescription: true,
      gradeLevel: true,
      terms: {
        select: { academicTermId: true },
        orderBy: { academicTerm: { position: "asc" } },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  if (!studentSubjectEnrollments.length) return [];

  await transaction.studentSubjectEnrollment.updateMany({
    where: {
      id: { in: studentSubjectEnrollments.map(({ id }) => id) },
      status: "ACTIVE",
    },
    data: { status: "REPLACED", replacedAt },
  });

  return studentSubjectEnrollments;
}

export async function createStudentSubjectEnrollmentsFromOfferings(
  enrollmentId: string,
  offerings: Array<{
    id: string;
    gradeLevel: string;
    subjectCode: string;
    subjectDescription: string;
    terms: Array<{ academicTermId: string }>;
  }>,
  createdById: string,
  transaction: Prisma.TransactionClient,
) {
  return Promise.all(
    offerings.map((offering) =>
      transaction.studentSubjectEnrollment.create({
        data: {
          enrollmentId,
          subjectOfferingId: offering.id,
          subjectCode: offering.subjectCode,
          subjectDescription: offering.subjectDescription,
          gradeLevel: offering.gradeLevel,
          createdById,
          terms: {
            create: offering.terms.map(({ academicTermId }) => ({ academicTermId })),
          },
        },
        select: {
          id: true,
          subjectOfferingId: true,
          subjectCode: true,
          subjectDescription: true,
          gradeLevel: true,
          terms: { select: { academicTermId: true } },
        },
      }),
    ),
  );
}

export async function lockActiveShsEnrollmentForCurriculumSelection(id: string, transaction: Prisma.TransactionClient) {
  const rows = await transaction.$queryRaw<Array<{ id: string; academicYearId: string; status: "ACTIVE" | "COMPLETED" | "DROPPED" | "TRANSFERRED"; academicYearStatus: string; gradeLevel: string }>>(Prisma.sql`
    SELECT "Enrollment"."id", "Enrollment"."academicYearId", "Enrollment"."status", "AcademicYear"."status" AS "academicYearStatus", "Section"."gradeLevel"
    FROM "Enrollment"
    INNER JOIN "AcademicYear" ON "AcademicYear"."id" = "Enrollment"."academicYearId"
    INNER JOIN "Section" ON "Section"."id" = "Enrollment"."sectionId"
    WHERE "Enrollment"."id" = ${id} AND "Enrollment"."deletedAt" IS NULL
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

const shsOfferingSelection = {
  id: true,
  gradeLevel: true,
  subjectCode: true,
  subjectDescription: true,
  terms: { select: { academicTermId: true, academicTerm: { select: { name: true, position: true } } }, orderBy: { academicTerm: { position: "asc" } } },
  shsContext: { select: { classification: true, curriculumStatus: true, sourceReference: true, approvalReference: true, cluster: { select: { code: true, name: true } } } },
} satisfies Prisma.SubjectOfferingSelect;

export async function findEligibleShsOfferingsForEnrollment(academicYearId: string, gradeLevel: string, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).subjectOffering.findMany({
    where: { academicYearId, gradeLevel, deletedAt: null, shsContext: { is: { curriculumStatus: "SCHOOL_APPROVED", OR: [{ classification: "CORE" }, { cluster: { is: { deletedAt: null } } }] } } },
    select: shsOfferingSelection,
    orderBy: { subjectCode: "asc" },
  });
}

export async function replaceDeselectedShsStudentSubjectEnrollments(enrollmentId: string, retainedOfferingIds: string[], replacedAt: Date, transaction: Prisma.TransactionClient) {
  const rows = await transaction.studentSubjectEnrollment.findMany({ where: { enrollmentId, status: "ACTIVE", subjectOffering: { shsContext: { isNot: null } }, subjectOfferingId: { notIn: retainedOfferingIds } }, select: { id: true, subjectCode: true, subjectDescription: true, gradeLevel: true, subjectOfferingId: true } });
  if (rows.length) await transaction.studentSubjectEnrollment.updateMany({ where: { id: { in: rows.map((row) => row.id) }, status: "ACTIVE" }, data: { status: "REPLACED", replacedAt } });
  return rows;
}

export async function createShsStudentSubjectEnrollmentsFromOfferings(enrollmentId: string, offerings: Awaited<ReturnType<typeof findEligibleShsOfferingsForEnrollment>>, createdById: string, transaction: Prisma.TransactionClient) {
  return Promise.all(offerings.map((offering) => transaction.studentSubjectEnrollment.create({ data: {
    enrollmentId, subjectOfferingId: offering.id, subjectCode: offering.subjectCode, subjectDescription: offering.subjectDescription, gradeLevel: offering.gradeLevel, createdById,
    shsClassification: offering.shsContext!.classification, shsClusterCode: offering.shsContext!.cluster?.code ?? null, shsClusterName: offering.shsContext!.cluster?.name ?? null, shsCurriculumStatus: offering.shsContext!.curriculumStatus, shsSourceReference: offering.shsContext!.sourceReference, shsApprovalReference: offering.shsContext!.approvalReference,
    terms: { create: offering.terms.map(({ academicTermId }) => ({ academicTermId })) },
  }, select: { id: true, subjectOfferingId: true, subjectCode: true } })));
}
