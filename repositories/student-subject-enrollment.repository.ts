import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";

const studentSubjectEnrollmentSelect = {
  id: true,
  enrollmentId: true,
  subjectOfferingId: true,
  selectionAcademicTermId: true,
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
  droppedAt: true,
  dropReason: true,
  createdAt: true,
  updatedAt: true,
  terms: {
    select: {
      academicTermId: true,
      academicTerm: {
        select: { name: true, position: true, startDate: true, endDate: true },
      },
      result: {
        select: {
          id: true,
          finalResult: true,
          status: true,
          finalizedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { academicTerm: { position: "asc" } },
  },
} satisfies Prisma.StudentSubjectEnrollmentSelect;

export async function findStudentSubjectEnrollments(
  query: { enrollmentId: string; status?: "ACTIVE" | "REPLACED" | "DROPPED" },
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
  const rows = await transaction.$queryRaw<Array<{ id: string; academicYearId: string; entryAcademicTermId: string | null; shsTrack: "ACADEMIC" | "TECHPRO" | null; status: "ACTIVE" | "COMPLETED" | "DROPPED" | "TRANSFERRED"; academicYearStatus: string; gradeLevel: string }>>(Prisma.sql`
    SELECT "Enrollment"."id", "Enrollment"."academicYearId", "Enrollment"."entryAcademicTermId", "Enrollment"."shsTrack", "Enrollment"."status", "AcademicYear"."status" AS "academicYearStatus", "Section"."gradeLevel"
    FROM "Enrollment"
    INNER JOIN "AcademicYear" ON "AcademicYear"."id" = "Enrollment"."academicYearId"
    INNER JOIN "Section" ON "Section"."id" = "Enrollment"."sectionId"
    WHERE "Enrollment"."id" = ${id} AND "Enrollment"."deletedAt" IS NULL
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export function findShsEnrollmentForCurrentTerm(id: string, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).enrollment.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      academicYearId: true,
      entryAcademicTermId: true,
      shsTrack: true,
      status: true,
      academicYear: { select: { status: true } },
      entryAcademicTerm: { select: { id: true, name: true, position: true } },
      section: { select: { gradeLevel: true } },
    },
  });
}

export function findActiveAcademicYearCalendars(transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).academicYear.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      label: true,
      status: true,
      terms: {
        select: { id: true, name: true, position: true, startDate: true, endDate: true },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { startDate: "asc" },
  });
}

export async function lockActiveShsStudentSubjectEnrollments(
  enrollmentId: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "StudentSubjectEnrollment"
    WHERE "enrollmentId" = ${enrollmentId} AND "status" = 'ACTIVE'
    ORDER BY "id"
    FOR UPDATE
  `);
  if (!rows.length) return [];
  return transaction.studentSubjectEnrollment.findMany({
    where: { id: { in: rows.map(({ id }) => id) } },
    select: studentSubjectEnrollmentSelect,
    orderBy: { id: "asc" },
  });
}

export function findShsStudentSubjectEnrollmentHistory(
  enrollmentId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.studentSubjectEnrollment.findMany({
    where: { enrollmentId, shsCurriculumStatus: { not: null } },
    select: studentSubjectEnrollmentSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

const shsOfferingSelection = {
  id: true,
  replacesSubjectOfferingId: true,
  academicYearId: true,
  gradeLevel: true,
  deletedAt: true,
  subjectCode: true,
  subjectDescription: true,
  terms: { select: { academicTermId: true, academicTerm: { select: { name: true, position: true } } }, orderBy: { academicTerm: { position: "asc" } } },
  shsContext: { select: { classification: true, curriculumStatus: true, sourceReference: true, approvalReference: true, cluster: { select: { code: true, name: true, deletedAt: true } } } },
} satisfies Prisma.SubjectOfferingSelect;

export async function findOfferingReplacementAncestors(
  offeringIds: string[],
  transaction?: Prisma.TransactionClient,
) {
  const orderedIds = [...new Set(offeringIds)].sort();
  if (!orderedIds.length) return [];
  return (transaction ?? prisma).$queryRaw<Array<{ offeringId: string; ancestorOfferingId: string }>>(Prisma.sql`
    WITH RECURSIVE lineage AS (
      SELECT offering."id" AS "offeringId",
        offering."replacesSubjectOfferingId" AS "ancestorOfferingId",
        CASE
          WHEN current_context."classification" = 'CORE' AND predecessor_context."classification" = 'CORE' THEN 'CORE'
          WHEN current_context."classification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE')
            AND predecessor_context."classification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE') THEN 'ELECTIVE'
          ELSE NULL
        END AS "continuationKind"
      FROM "SubjectOffering" offering
      JOIN "SubjectOfferingShsContext" current_context ON current_context."subjectOfferingId" = offering."id"
      JOIN "SubjectOfferingShsContext" predecessor_context ON predecessor_context."subjectOfferingId" = offering."replacesSubjectOfferingId"
      WHERE offering."id" IN (${Prisma.join(orderedIds)})
        AND offering."replacesSubjectOfferingId" IS NOT NULL
      UNION ALL
      SELECT lineage."offeringId", predecessor."replacesSubjectOfferingId", lineage."continuationKind"
      FROM lineage
      JOIN "SubjectOffering" predecessor
        ON predecessor."id" = lineage."ancestorOfferingId"
      JOIN "SubjectOfferingShsContext" next_context ON next_context."subjectOfferingId" = predecessor."replacesSubjectOfferingId"
      WHERE predecessor."replacesSubjectOfferingId" IS NOT NULL
        AND (
          (lineage."continuationKind" = 'CORE' AND next_context."classification" = 'CORE')
          OR (lineage."continuationKind" = 'ELECTIVE' AND next_context."classification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE'))
        )
    )
    SELECT "offeringId", "ancestorOfferingId"
    FROM lineage
    WHERE "continuationKind" IS NOT NULL
    ORDER BY "offeringId", "ancestorOfferingId"
  `);
}

export async function findEligibleShsOfferingsForEnrollment(academicYearId: string, gradeLevel: string, transaction?: Prisma.TransactionClient) {
  return (transaction ?? prisma).subjectOffering.findMany({
    where: { academicYearId, gradeLevel, deletedAt: null, shsContext: { is: { curriculumStatus: "SCHOOL_APPROVED", OR: [{ classification: "CORE" }, { cluster: { is: { deletedAt: null } } }] } } },
    select: shsOfferingSelection,
    orderBy: { subjectCode: "asc" },
  });
}

export async function lockShsOfferingsById(
  ids: string[],
  transaction: Prisma.TransactionClient,
) {
  const orderedIds = [...new Set(ids)].sort();
  if (!orderedIds.length) return [];
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "SubjectOffering"
    WHERE "id" IN (${Prisma.join(orderedIds)})
    ORDER BY "id"
    FOR UPDATE
  `);
  return transaction.subjectOffering.findMany({
    where: { id: { in: rows.map(({ id }) => id) } },
    select: shsOfferingSelection,
    orderBy: { id: "asc" },
  });
}

export function findApprovedShsCoreOfferingIds(
  academicYearId: string,
  gradeLevel: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.subjectOffering.findMany({
    where: {
      academicYearId,
      gradeLevel,
      deletedAt: null,
      shsContext: { is: { classification: "CORE", curriculumStatus: "SCHOOL_APPROVED" } },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });
}

type LockedShsOffering = Awaited<ReturnType<typeof lockShsOfferingsById>>[number];

function shsSnapshotData(offering: LockedShsOffering) {
  return {
    subjectOfferingId: offering.id,
    subjectCode: offering.subjectCode,
    subjectDescription: offering.subjectDescription,
    gradeLevel: offering.gradeLevel,
    shsClassification: offering.shsContext!.classification,
    shsClusterCode: offering.shsContext!.cluster?.code ?? null,
    shsClusterName: offering.shsContext!.cluster?.name ?? null,
    shsCurriculumStatus: offering.shsContext!.curriculumStatus,
    shsSourceReference: offering.shsContext!.sourceReference,
    shsApprovalReference: offering.shsContext!.approvalReference,
  };
}

export function createProgressiveShsCoreParticipation(
  enrollmentId: string,
  offering: LockedShsOffering,
  academicTermIds: string[],
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.studentSubjectEnrollment.create({
    data: {
      enrollmentId,
      ...shsSnapshotData(offering),
      createdById: actorId,
      terms: { create: academicTermIds.map((academicTermId) => ({ academicTermId })) },
    },
    select: { id: true, subjectOfferingId: true, subjectCode: true, subjectDescription: true },
  });
}

export function createProgressiveShsElectiveParticipation(
  enrollmentId: string,
  offering: LockedShsOffering,
  academicTermId: string,
  actorId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.studentSubjectEnrollment.create({
    data: {
      enrollmentId,
      ...shsSnapshotData(offering),
      selectionAcademicTermId: academicTermId,
      createdById: actorId,
      terms: { create: { academicTermId } },
    },
    select: { id: true, subjectOfferingId: true, subjectCode: true, subjectDescription: true },
  });
}

export async function dropActiveStudentSubjectEnrollment(
  id: string,
  droppedAt: Date,
  dropReason: string,
  transaction: Prisma.TransactionClient,
) {
  const result = await transaction.studentSubjectEnrollment.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "DROPPED", droppedAt, dropReason },
  });
  if (result.count !== 1) return null;
  return transaction.studentSubjectEnrollment.findUnique({
    where: { id },
    select: studentSubjectEnrollmentSelect,
  });
}

export async function replaceActiveStudentSubjectEnrollment(
  id: string,
  replacedAt: Date,
  transaction: Prisma.TransactionClient,
) {
  const result = await transaction.studentSubjectEnrollment.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "REPLACED", replacedAt },
  });
  return result.count === 1;
}
