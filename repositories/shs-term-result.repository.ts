import { Prisma } from "@/app/generated/prisma/client";

export async function lockEnrollmentForShsTermResult(
  id: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "Enrollment"
    WHERE "id" = ${id} AND "deletedAt" IS NULL
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export async function lockStudentSubjectEnrollmentForTermResult(
  id: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "StudentSubjectEnrollment"
    WHERE "id" = ${id}
    FOR UPDATE
  `);
  if (!rows.length) return null;
  return transaction.studentSubjectEnrollment.findUnique({
    where: { id },
    select: {
      id: true,
      enrollmentId: true,
      subjectCode: true,
      subjectDescription: true,
      gradeLevel: true,
      shsCurriculumStatus: true,
      status: true,
    },
  });
}

export async function lockStudentSubjectEnrollmentTermForResult(
  studentSubjectEnrollmentId: string,
  academicTermId: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ academicTermId: string }>>(Prisma.sql`
    SELECT "academicTermId"
    FROM "StudentSubjectEnrollmentTerm"
    WHERE "studentSubjectEnrollmentId" = ${studentSubjectEnrollmentId}
      AND "academicTermId" = ${academicTermId}
    FOR UPDATE
  `);
  if (!rows.length) return null;
  return transaction.studentSubjectEnrollmentTerm.findUnique({
    where: {
      studentSubjectEnrollmentId_academicTermId: {
        studentSubjectEnrollmentId,
        academicTermId,
      },
    },
    select: {
      academicTermId: true,
      academicTerm: {
        select: { id: true, name: true, startDate: true, endDate: true },
      },
    },
  });
}

export async function lockShsTermResult(
  studentSubjectEnrollmentId: string,
  academicTermId: string,
  transaction: Prisma.TransactionClient,
) {
  const rows = await transaction.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"
    FROM "ShsTermResult"
    WHERE "studentSubjectEnrollmentId" = ${studentSubjectEnrollmentId}
      AND "academicTermId" = ${academicTermId}
    FOR UPDATE
  `);
  if (!rows.length) return null;
  return transaction.shsTermResult.findUnique({
    where: {
      studentSubjectEnrollmentId_academicTermId: {
        studentSubjectEnrollmentId,
        academicTermId,
      },
    },
  });
}

export function createShsTermResultDraft(
  data: {
    studentSubjectEnrollmentId: string;
    academicTermId: string;
    finalResult: number | null;
    actorId: string;
  },
  transaction: Prisma.TransactionClient,
) {
  return transaction.shsTermResult.create({
    data: {
      studentSubjectEnrollmentId: data.studentSubjectEnrollmentId,
      academicTermId: data.academicTermId,
      finalResult: data.finalResult,
      createdById: data.actorId,
    },
  });
}

export async function updateShsTermResultDraft(
  id: string,
  finalResult: number | null,
  transaction: Prisma.TransactionClient,
) {
  const updated = await transaction.shsTermResult.updateMany({
    where: { id, status: "DRAFT" },
    data: { finalResult },
  });
  if (updated.count !== 1) return null;
  return transaction.shsTermResult.findUnique({ where: { id } });
}

export async function finalizeShsTermResult(
  id: string,
  actorId: string,
  finalizedAt: Date,
  transaction: Prisma.TransactionClient,
) {
  const updated = await transaction.shsTermResult.updateMany({
    where: { id, status: "DRAFT", finalResult: { not: null } },
    data: { status: "FINALIZED", finalizedById: actorId, finalizedAt },
  });
  if (updated.count !== 1) return null;
  return transaction.shsTermResult.findUnique({ where: { id } });
}
